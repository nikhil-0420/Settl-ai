# Settl.ai — What Broke, and How We Got Out

A running, honest record of real bugs hit across the full build — not a
curated highlight reel. Kept live during development, not reconstructed
after the fact, per the buildathon's own submission criteria.

---

## Matching engine

### 1. Relative path breaks depending on where the script is run from

`OUT_DIR`/`DATA_DIR` resolved relative to the shell's current working
directory, not the script's own location — running the same script from
`backend/` vs `backend/app/` silently pointed at two different folders,
causing `FileNotFoundError`s that looked random. **Fix:** anchored every
path to `Path(__file__).parent`, never a relative string.

### 2. A real fee error was masked by an earlier amount-match check

The fee/tax arithmetic check was nested *inside* the amount-match branch —
so when a corrupted `net_amount` happened to match the bank credit exactly
(because both were derived from the same wrong fee), the fee error never
got evaluated at all. **Fix:** moved the fee/tax correctness check to run
independently, before the amount-match branch, so a downstream value that's
already wrong can't hide from a check that only compares it to itself.

### 3. One tolerance constant serving two different precision needs

`AMOUNT_TOLERANCE` (a loose ~₹50 "close enough" band for real-world partial
payments) was being reused for fee/TDS correctness checks, which need to be
exact to the paisa. A small-but-real fee error slipped under the shared
tolerance. **Fix:** split into `AMOUNT_TOLERANCE`, `FEE_TOLERANCE`, and
`TDS_TOLERANCE`, each sized for what it's actually checking.

### 4. Percentage-severity seeded errors could fall under a flat-₹ tolerance

A "subtle" seeded error defined as a percentage of the transaction amount
could, for a small transaction, work out to fewer rupees than the flat
tolerance it was meant to trip — making the seeded mismatch invisible to
the matcher. **Fix:** deterministic severity tiers, resized against the
smallest possible transaction amount so every tier reliably clears its
tolerance.

**Result of fixing 1–4:** matching engine at **100% accuracy (87/87)**
against seeded ground truth.

### 5. Git silently drops empty folders

`frontend/` existed on disk but never made it into the first commit —
git doesn't track empty directories at all, regardless of whether the
folder itself exists. Confirmed via `git ls-files` (what git actually
tracks) vs. `dir` (what the filesystem shows) — they told two different
stories. **Fix:** added a placeholder file inside the folder.

---

## Embeddings / retrieval

### 6. Chroma requires unique document IDs — the `duplicate` status broke that

The `duplicate` mismatch type is deliberately seeded so two settlement rows
share the same `order_id` — correct behavior for the matcher, but Chroma's
indexer used `order_id` as the document ID and rejected the second insert
as a collision. **Fix:** disambiguated with `settlement_id` whenever an
`order_id` collision is detected.

### 7. Semantic embeddings don't reliably retrieve arbitrary alphanumeric IDs

An `order_id` like `order_200036U` has no real semantic meaning for a
vector search to latch onto. **Fix:** hybrid retrieval — an explicit
`order_id` regex match runs first, with semantic search as fallback/padding
only when needed.

---

## Q&A agent / live-server wiring

### 8. A three-bug chain, each masking the next

Wiring the Q&A agent into the live FastAPI server (not just standalone
scripts) surfaced three independent, unrelated bugs back to back:

- **Import path resolution under uvicorn** — a sibling import
  (`from qa_agent import ask`) worked fine when run as a standalone script
  (Python auto-adds the script's own directory to `sys.path`), but uvicorn
  loads `main.py` as part of a package and never added `app/` to the path.
  Fixed with an explicit `sys.path.insert(0, ...)`.
- **Chroma concurrency bug** — `search()` created a brand-new
  `chromadb.PersistentClient` on every call, which raced Chroma's internal
  teardown logic under FastAPI's concurrent request handling and crashed
  with a `KeyError`/`AttributeError`. Fixed with a lazily-created,
  module-level singleton client instead of one per request.
- **SDK API mismatch** — after migrating to the newer `google.genai` SDK,
  `MODEL` was correctly a plain string, but the call site still used the
  older SDK's `MODEL.generate_content(...)` pattern. Fixed with
  `client.models.generate_content(model=MODEL, contents=prompt)`.

**Lesson:** none of the three were caused by the others — a script running
cleanly proves far less than it feels like it proves; the real deployment
context (a live, concurrent server) is what finally exercised each one.

### 9. `/ask` returned 405 Method Not Allowed

The backend route was `@app.get("/ask")` reading a query param; the
frontend had already moved to `POST` with a JSON body (a long or
special-character question breaks as a URL query param, so the frontend
was right and the backend had drifted). **Fix:** `@app.post("/ask")` with a
Pydantic `AskRequest` body model. *(A later, unrelated 405 was just someone
hitting the URL directly via `GET` in a browser — not a bug, expected
behavior for a POST-only route.)*

### 10. A real before/after bugfix, caught by comparing two eval runs

An earlier eval run (n=72, 95.2% correctness) had exactly 3 failures, all
on the same record — the agent's answer was substantively correct but also
cited extra, accurate-but-out-of-scope settlement IDs alongside the
expected order ID, which the eval's exact-set citation check penalized as
wrong. **Fix:** tightened the citation instruction to cite only the
order-level ID being asked about. Re-eval confirmed 95.2% → 100%.

### 11. Multi-turn Ask over-refused instead of resolving a follow-up reference

"Why didn't order_200036U reconcile cleanly?" → "What is its confidence
score?" returned a refusal, even though retrieval correctly pulled the
right record. **Root cause:** a prompt-instruction ordering bug, not code —
the history section led with a restriction ("never treat this as a fact
source") before explaining what it was for, and the model over-generalized
that caution into refusing to resolve "its" at all. **Fix:** rewrote the
section to lead with explicit permission (resolve the pronoun using the
prior exchange, then answer only from the Records section), keeping the
same underlying guardrail but in the right order.

### 12. A second, broader gap in the same follow-up logic

Even after fix #11, an implicit follow-up with **no pronoun at all** (e.g.
"what is **the** confidence score?" right after an order-specific question)
still fell through to `False` in `needs_history_context()`, since it only
matched explicit pronouns (`it`, `that`, `its`). **Fix:** inverted the
default — any question without its own `order_id` or a status keyword is
now assumed to be a continuation of the previous turn, plus a
`BROAD_QUERY_KEYWORDS` list so genuinely unrelated aggregate questions
don't get diluted with unrelated prior-turn context.

### 13. Confirmed and fixed — topic drift from over-eager history inclusion

Root cause confirmed: when building the search query for a new question,
the last 2 turns of history (`history[-2:]`) were being folded in
unconditionally — including for a fresh, unrelated question that should
have been answered standalone, ignoring prior context entirely. A question
that should have triggered a normal, self-contained search (e.g. "Which
orders have TDS mismatches?" asked right after an unrelated confidence-score
follow-up) got its search query diluted with leftover context from the
previous exchange, and the model treated it as a continuation of that
earlier thread instead of a fresh question — returning only 1 of the 3
correct records instead of all 3.

**Fix:** rather than a retrieval-layer change, this was fixed at the prompt
level — tightening the instruction so the model explicitly recognizes when
a question is self-contained (names its own subject/topic) and should
disregard prior turns entirely, versus when it's genuinely referential and
should resolve against history. Re-tested against the same fresh-topic
question immediately following an unrelated follow-up — now returns all 3
correct records.

**Lesson:** the same underlying failure mode as bug #11 (over-restrictive
history handling), but in the opposite direction — #11 was the model
refusing to use history when it should have; #13 was the model using
history when it shouldn't have. Both were prompt-instruction problems, not
retrieval bugs, and both needed the model to correctly distinguish
"standalone" from "referential" rather than applying history uniformly.

---

## Confidence validation (Milestone 6.5)

### 14. A confidence score that looked constant, then a subtler bug underneath

Reworking `compute_confidence()` from fixed per-status constants to
genuine per-record variance initially still showed flat values for two
statuses, because the seeded severities were all "severe" relative to
their tolerances — the formula was correct, the sample lacked low-severity
cases. Widening the random range didn't fully fix it either (small n=3
could still draw all-severe by chance). **Fix:** deterministic severity
tiers, which also surfaced a second, real bug — a percentage-based
"subtle" severity tier could fall under a flat-₹ tolerance for small
transactions (see matching-engine bug #4 above, found via this same
investigation).

**Honest framing carried into the writeup:** the severity-tracking
validation is an internal consistency check across 3 deterministic
tiers per status — not a statistically powered claim (n=3 makes Spearman
correlation not meaningful on its own), and it's close to tautological
since both the confidence score and the validation's deviation measure
derive from the same underlying quantity via a monotonic transform.

---

## Frontend — structural and rendering bugs

### 15. Simulate-outage toggle knob rendered outside its own pill

The knob was absolutely positioned with `top-1` but no `left` anchor —
without an explicit anchor, `translate-x-6` moved it relative to an
undefined starting position, pushing it outside the visible track
entirely. **Fix:** added `left-1` as the anchor, corrected the translate
values to stay inside the track with an even margin.

### 16. Dashboard confidence tooltip was clipped

The `InfoTooltip` opened upward (`bottom-full`) inside a
`panel overflow-hidden` container — the overflow rule (added for unrelated
rounded-corner reasons) sliced off anything rendered above the panel's top
edge. **Fix:** added a `side` prop so the tooltip can open downward where
there's room.

### 17. Missing closing tags broke JSX parsing in two places

A dropped `</span>` while restructuring the Dashboard header cell, and a
dropped opening `<a` tag on both export buttons (which cascaded into a
misleading error pointing at a completely unrelated, actually-correct
`</div>` much further down the file). The same failure mode recurred later
on the 404 page's GitHub link and was eventually resolved by typing the
line manually instead of pasting it. **Lesson:** when a JSX error points at
a tag that looks correct, check earlier in the same block for a missing
*opening* tag first — one broken tag can misparse everything after it.

### 18. RecordDetail's status badge always showed "open"

Every record, regardless of real classification, showed a hardcoded
placeholder — `generate_data.py` writes `"status": "open"` on every
settlement row and it's never overwritten; the real classification only
ever lived in `reconciliation_summary.json`, and `/records/{order_id}`
never joined it in. **Fix:** the endpoint now looks up and returns
`classified_status`/`confidence` from the summary alongside the raw rows.

### 19. Audit trail badge overflow — a `width` utility with zero effect

`w-40` on an event-type badge did nothing at all, because the badge is a
`<span>` and CSS width utilities don't apply to `display: inline`
elements, full stop, regardless of value. **Fix:** added `inline-block`,
plus `truncate` as a safety net.

### 20. Audit trail never rendered any entry's detail text, for any event type

`Audit.jsx` read `entry.reasoning`; every call site in `audit.py`'s
`log_decision()` had only ever written to `detail`. The mismatch existed
since Milestone 8 and affected every event type equally — a silent,
harmless-looking bug that sat undetected until a new event type's content
specifically needed checking. **Fix:** read `entry.detail` instead.

### 21. Manual resolution notes still weren't visible, even after fix #20

The resolve endpoint's `log_decision()` call put the real reviewer note
into the `answer` field but a generic placeholder into `detail` — the
field the UI actually reads. Logged correctly, just not into a field
anyone could see. **Fix:** included the note text directly in `detail`.

### 22. `ledger_by_order`: a real matcher blind spot, found via adversarial test data

`classify_settlement_row(row, bank_by_utr, ledger_by_order)` accepted
`ledger_by_order` as a parameter but never referenced it in the function
body — meaning a record with clean settlement+bank data could still return
`clean_match` even with a missing ledger invoice or a wildly mismatched
`expected_amount`. The existing `phantom_ledger` status did **not** cover
this — it only fires for an orphan ledger row with no settlement match at
all, a real, separate, correctly-working check.

**Found via:** deliberately constructed test CSVs containing a clean
settlement+bank pair with (a) no corresponding ledger entry and (b) a
mismatched ledger amount — both landed in `clean_match` on the first run.

**Fix:** added a ledger check as the final step before returning
`clean_match`, reached only once fee/TDS/amount/date checks already pass.
Two new statuses: `ledger_missing`, `ledger_mismatch`. Confidence scoring
and `StatusBadge.jsx` updated to match.

**Verified:** re-ran the same test data post-fix — `clean_match` dropped
from 7 → 5 exactly as predicted; both blind-spot rows reclassified
correctly. 19/19 records matched prediction exactly.

---

## UI/UX polish pass

### 23. ReactiveBackground was fully built and never actually shown

The component was imported in `App.jsx` but never rendered anywhere in the
JSX tree — a dead import producing zero visual effect, with no error to
catch it. **Fix:** mounted `<ReactiveBackground />`, and added the
always-visible base grid layer the original plan called for but the first
pass had omitted. *(The background's visual content itself was iterated on
extensively afterward — several further rounds, including glow/aurora and
ruled-line attempts that were tried and deliberately scrapped, landing back
on an improved dot-grid spotlight.)*

### 24. RecordDetail's UTR connecting line: real math, zero pixels

The position-calculation logic (`getBoundingClientRect()`, a `linePos`
state, a `useLayoutEffect` recalculating on resize) was fully correct —
but no `<svg>`/`<line>` element in the file ever consumed `linePos` to
actually draw anything. All the computation ran on every render, producing
a value nothing used. **Fix (first pass):** added the missing SVG
draw-in. **Later superseded entirely:** on visual review the line still
read as messy even correctly positioned (a diagonal cutting across two
cards, since `utr` sits at a different row position in each panel) —
replaced with a simpler, cleaner signal: highlighting the matched UTR
value in brass on both cards, no SVG required.

**Lesson (both #23 and #24):** a feature can be entirely correct at the
data/logic layer and still be completely invisible or unconvincing —
"compute the right value" and "render something that actually looks right"
are two separate steps, and only one throws an error if you skip it.

### 25. Recharts default hover-highlight swallowed the bars

Bar charts showed a full-height translucent rectangle on hover by default
(Recharts' `background` prop on `<Bar>`), visually hiding the real bar
underneath. **Fix:** `background={{ fill: "transparent" }}`.

### 26. X-axis labels silently auto-skipped

With 8 status categories in one chart, Recharts dropped every other label
to avoid overlap — looked like missing data. **Fix:** `interval={0}` plus
angled labels.

### 27. `TiltCard` broke height propagation between paired panels

Two side-by-side decision panels rendered at different heights despite
`items-stretch` on the grid — `h-full` wasn't propagating through
`TiltCard`'s wrapper `motion.div`. Resolved by removing the content-length
mismatch that was causing the two panels to want different heights in the
first place, rather than fighting the height-propagation chain directly.

### 28. Outage-refusal wording was misleading

The "what it tried" refusal detail said "none supported a confident, cited
answer" for the simulated-outage path too — but those records *were*
retrieved fine; the LLM simply never got the chance to evaluate them
because the service call itself failed. Caught by reviewing an actual
screenshot of the outage-sim path before shipping. **Fix:** distinct
wording for the two genuinely different refusal reasons.

### 29. Stale function signature after a live-refactor

After refactoring `classifier.py`/`matcher.py` to accept an optional
`data_dir` parameter for the live-upload feature, the `/upload` endpoint
failed with `build_summary() got an unexpected keyword argument
'data_dir'` — the edit hadn't actually saved; the old signature was still
on disk. Traced with `Select-String -Path .\classifier.py -Pattern "def
build_summary"` before re-applying the fix.

---

## Deployment (Render + Vercel)

### 30. Silent OOM kill on `/ask` — no traceback, no warning

`/ask` requests died with zero response and nothing in the logs. **Root
cause:** `sentence-transformers` (the local embedding model) pulls in
`torch`; on Render's free tier (~512MB RAM), loading it OOM-killed the
process on the first `/ask` call. The OS kills the process directly, so no
Python exception is ever raised — GET endpoints worked fine the entire
time, masking the issue. **Fix:** migrated `embeddings.py` from local
`sentence-transformers` to Google's Gemini embedding API
(`gemini-embedding-001`), removing the heavy local dependency entirely.

### 31. Missing Chroma collection after the embedding migration

`chromadb.errors.NotFoundError: Collection [reconciliation_records] does
not exist`. A CORS error in the browser was a red herring masking this
real 500 underneath (Starlette's CORS middleware doesn't always attach
CORS headers to error responses). **Root cause:** `chroma_db/` was
gitignored, so the locally pre-built index never reached Render — a fresh
clone on every deploy means no folder, no collection. **Fix:** added
`ensure_index_built()`, hooked into FastAPI's startup event, rebuilding
the index from `reconciliation_summary.json` if missing or empty.

### 32. Chroma API compatibility break on the custom embedding function

`AttributeError: 'GeminiEmbeddingFunction' object has no attribute 'name'`.
Newer `chromadb` requires custom embedding functions to properly subclass
`chromadb.EmbeddingFunction` (`name()`, `build_from_config()`,
`get_config()`), not just implement `__call__`. **Fix:** updated the class
to the full required interface.

### 33. Leftover heavy dependency after migration

`sentence-transformers` (and `torch`) was still being installed on every
Render build despite no longer being imported anywhere in code — confirmed
via a recursive search before removing it from `requirements.txt`,
lightening the build.

---

## Process / tooling incidents

Not application bugs, but real, worth keeping for the record:

- **Accidental permanent deletion of `frontend/package.json` /
  `package-lock.json`** — a `Remove-Item` was run one directory too deep.
  PowerShell's `Remove-Item` bypasses the Recycle Bin, and the files had
  never been committed, so `git restore` had nothing to pull from either.
  Recovered by reading exact installed versions back out of the surviving
  `node_modules/` folder.
- **A stray root-level `npm install`** created a phantom `package.json` at
  the repo root instead of inside `frontend/`. Caught and deleted before
  commit. Notably, `framer-motion` was never actually present in the real
  `frontend/node_modules` despite being imported throughout the codebase —
  the app was likely not running successfully end-to-end locally until
  this was caught.
- **PowerShell doesn't support `&&`** as a bash-style command separator
  (pre-PowerShell 7) — chained git commands threw a `ParserError`. Used
  `;` or separate lines instead.
- **GitHub/local history diverged for weeks** — `origin/main` had been
  frozen at the initial-scaffold commit while all real development
  (embeddings through live-upload) happened locally, plus a stray commit
  made directly on github.com that local didn't have. Resolved via `git
  fetch` + merge (conflict only in `README.md`, kept the local version)
  and a merge of the `live-upload-feature` branch, both pushed — confirmed
  clean via a linear commit history check.

---

*Every entry in this log has a confirmed fix and, where applicable, a
verified before/after result — none left open.*