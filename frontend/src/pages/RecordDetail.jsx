import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import StatusBadge from "../components/StatusBadge.jsx";
import { api, CONFIDENCE_EXPLANATIONS } from "../lib/api.js";
import InfoTooltip from "../components/InfoTooltip.jsx";
import { motion } from "framer-motion";
import CopyButton from "../components/CopyButton.jsx";

const FLAGGED_FIELDS = {
  fee_deduction_err: ["fee", "tax"],
  tds_gst_mismatch: ["tds"],
  partial_payment: ["credit_amount"],
  timing_gap: ["value_date"],
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

function SourcePanel({ title, data, emptyLabel, flaggedKeys = [], matchedKeys = [], step }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2 mb-4">
        {step && (
          <span className="num flex items-center justify-center h-5 w-5 rounded-full border border-rule text-ink-faint text-[10px] shrink-0">
            {step}
          </span>
        )}
        <div className="text-xs uppercase tracking-wider text-ink-faint">{title}</div>
      </div>
      {data ? (
        <dl className="space-y-2.5">
          {Object.entries(data).map(([key, value]) => {
            const isFlagged = flaggedKeys.includes(key);
            const isMatched = matchedKeys.includes(key);
            return (
              <div key={key} data-field={key} className="flex items-center justify-between gap-4">
                <dt className={`text-xs ${isFlagged ? "text-settle-critical" : "text-ink-muted"}`}>
                  {key.replace(/_/g, " ")}
                </dt>
                <dd
                  className={`num text-sm text-right ${isFlagged
                    ? "text-settle-critical font-semibold bg-settle-critical/10 px-2 py-0.5 rounded"
                    : isMatched
                      ? "text-brass font-semibold bg-brass/10 px-2 py-0.5 rounded"
                      : "text-ink-primary"
                    }`}
                >
                  {String(value)}
                  {(key === "utr" || key.endsWith("_id")) && <CopyButton value={String(value)} />}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="text-sm text-settle-critical">{emptyLabel}</p>
      )}
    </div>
  );
}

function ResolutionPanel({ orderId, resolution, onResolved }) {
  const [note, setNote] = useState(resolution?.note || "");
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [justSaved, setJustSaved] = useState(false);

  const submit = async () => {
    if (!note.trim() || submitting) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      const result = await api.resolveRecord(orderId, note.trim());
      onResolved(result.resolution);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel p-5 mt-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-ink-faint">Reviewer resolution</div>
        {resolution && (
          <span className="text-xs text-ink-faint">
            resolved {new Date(resolution.resolved_at).toLocaleString()}
          </span>
        )}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note on how this exception was reviewed or resolved…"
        rows={3}
        className="w-full bg-transparent border border-rule rounded-md px-3 py-2 text-sm text-ink-primary placeholder:text-ink-faint focus:outline-none focus:border-brass"
      />
      {saveError && <p className="text-xs text-settle-critical mt-2">{saveError}</p>}
      <div className="flex justify-end mt-3">
        <button
          onClick={submit}
          disabled={submitting || !note.trim()}
          className={`px-4 py-2 rounded-md font-medium text-xs transition-colors disabled:opacity-50 ${justSaved ? "bg-settle-match text-bg" : "bg-brass text-bg hover:bg-brass-soft"
            }`}
        >
          {justSaved ? "Saved ✓" : submitting ? "Saving…" : resolution ? "Update note" : "Mark as resolved"}
        </button>
      </div>
    </div>
  );
}

export default function RecordDetail() {
  const { orderId } = useParams();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);
  const settlementRef = useRef(null);
  const bankRef = useRef(null);
  const [linePos, setLinePos] = useState(null);

  useEffect(() => {
    setLoading(true);
    api
      .recordDetail(orderId)
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  useLayoutEffect(() => {
    if (!detail?.settlement?.utr || detail.bank?.utr !== detail.settlement.utr) {
      setLinePos(null);
      return;
    }

    const measure = () => {
      const container = containerRef.current;
      const fromEl = settlementRef.current?.querySelector('[data-field="utr"]');
      const toEl = bankRef.current?.querySelector('[data-field="utr"]');
      if (!container || !fromEl || !toEl) return;

      const containerBox = container.getBoundingClientRect();
      const fromBox = fromEl.getBoundingClientRect();
      const toBox = toEl.getBoundingClientRect();

      setLinePos({
        x1: fromBox.right - containerBox.left,
        y1: fromBox.top + fromBox.height / 2 - containerBox.top,
        x2: toBox.left - containerBox.left,
        y2: toBox.top + toBox.height / 2 - containerBox.top,
      });
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [detail]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <Link to="/dashboard" className="text-xs text-ink-muted hover:text-brass">
        ← Back to dashboard
      </Link>

      <div className="flex items-center justify-between mt-4 mb-10">
        <h1 className="num font-display text-2xl font-semibold">{orderId}</h1>
        <div className="flex items-center gap-3">
          {detail?.confidence != null && (
            <span className="num text-sm text-ink-muted inline-flex items-center">
              confidence {detail.confidence}
              <InfoTooltip
                side="bottom"
                text={
                  CONFIDENCE_EXPLANATIONS[detail.classified_status] ||
                  "No graduated confidence logic applies to this status."
                }
              />
            </span>
          )}
          {detail?.classified_status && <StatusBadge status={detail.classified_status} />}
        </div>
      </div>

      {loading && <p className="text-ink-faint">Loading record…</p>}
      {error && (
        <div className="panel p-4 border-settle-critical/40 text-settle-critical text-sm">
          {error}
        </div>
      )}

      {detail && (
        <>
          <motion.div
            className="grid md:grid-cols-3 gap-5 relative"
            variants={container}
            initial="hidden"
            animate="show"
            ref={containerRef}
          >
            <motion.div variants={item} ref={settlementRef}>
              <SourcePanel
                title="Settlement report"
                step={1}
                data={detail.settlement}
                emptyLabel="No settlement record found for this order."
                flaggedKeys={FLAGGED_FIELDS[detail.classified_status] || []}
                matchedKeys={detail.bank?.utr === detail.settlement?.utr ? ["utr"] : []}

              />
            </motion.div>
            <motion.div variants={item} ref={bankRef}>
              <SourcePanel
                title="Bank statement"
                step={2}
                data={detail.bank}
                emptyLabel="No matching bank credit found — this is the gap the matcher flagged."
                flaggedKeys={FLAGGED_FIELDS[detail.classified_status] || []}
                matchedKeys={detail.bank?.utr === detail.settlement?.utr ? ["utr"] : []}
              />
            </motion.div>
            <motion.div variants={item}>
              <SourcePanel
                title="Internal ledger"
                step={3}
                data={detail.ledger}
                emptyLabel="No ledger invoice found for this order."
                flaggedKeys={[]}
              />
            </motion.div>
            {linePos && (
              <svg className="absolute inset-0 hidden md:block pointer-events-none" style={{ width: "100%", height: "100%" }}>
                <line x1={linePos.x1} y1={linePos.y1} x2={linePos.x2} y2={linePos.y2}
                  stroke="#D4A94F" strokeWidth="1.5" strokeDasharray="4 3" />
                <circle cx={linePos.x1} cy={linePos.y1} r="3" fill="#D4A94F" />
                <circle cx={linePos.x2} cy={linePos.y2} r="3" fill="#D4A94F" />
              </svg>
            )}
          </motion.div>
          <ResolutionPanel
            orderId={orderId}
            resolution={detail.resolution}
            onResolved={(resolution) => setDetail((prev) => ({ ...prev, resolution }))}
          />
        </>
      )}
    </div>
  );
}
