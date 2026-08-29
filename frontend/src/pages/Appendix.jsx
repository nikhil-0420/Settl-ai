import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api.js";
import TiltCard from "../components/TiltCard.jsx";

const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
};
const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

function Section({ title, children }) {
    return (
        <motion.div variants={item}>
            <TiltCard>
                <div className="panel p-6">
                    <h2 className="font-display font-semibold text-lg mb-3">{title}</h2>
                    <div className="text-sm text-ink-muted leading-relaxed space-y-3">
                        {children}
                    </div>
                </div>
            </TiltCard>
        </motion.div>
    );
}

function Formula({ children }) {
    return (
        <div className="num text-xs bg-panel-raised border border-rule rounded-md px-3 py-2 text-brass">
            {children}
        </div>
    );
}

export default function Appendix() {
    const [summary, setSummary] = useState(null);
    const [auditStats, setAuditStats] = useState(null);

    useEffect(() => {
        api.matchSummary().then(setSummary).catch(() => { });
        api
            .auditLog(200)
            .then((data) => {
                const counts = { answered: 0, refused: 0, outage_fallback: 0 };
                for (const entry of data.entries || []) {
                    if (entry.event_type in counts) counts[entry.event_type] += 1;
                }
                setAuditStats(counts);
            })
            .catch(() => { });
    }, []);

    return (
        <div className="max-w-3xl mx-auto px-6 py-12">
            <h1 className="font-display text-3xl font-semibold">How it works</h1>
            <p className="text-ink-muted mt-2 leading-relaxed">
                A one-page technical reference — matcher rules, confidence scoring,
                the Q&A citation pipeline, and refusal criteria. Not a marketing
                page: the numbers below are pulled live from the running system.
            </p>

            <motion.div
                className="mt-8 space-y-6"
                variants={container}
                initial="hidden"
                animate="show"
            >
                <Section title="1. Deterministic matching">
                    <p>
                        Every record runs through a fixed rule pipeline, not a model — the same
                        input always produces the same classification. Checks run in this
                        order, and the first one that fails determines the classification:
                    </p>
                    <ol className="list-decimal list-inside space-y-1">
                        <li>Duplicate check — same order_id appearing more than once in the settlement report</li>
                        <li>Exact UTR match against the bank statement (no match → unmatched)</li>
                        <li>Fee + tax arithmetic — expected 2% fee + 18% GST on that fee, exact to ±₹1</li>
                        <li>TDS arithmetic — expected 1% under Sec 194-O, exact to ±₹1</li>
                        <li>Amount comparison — bank credit vs. settlement net amount, within ±₹50</li>
                        <li>Date window — bank credit date vs. settlement date, normal window is T+2, up to T+14 still counts as a timing gap rather than unmatched</li>
                    </ol>
                    <p>
                        Records with no counterpart at all — a bank credit with no matching
                        settlement, or a ledger invoice with no matching settlement order — are
                        flagged as phantom_bank / phantom_ledger regardless of any of the above.
                    </p>
                    <p className="text-xs text-ink-faint mt-1">
                        Self-graded against a ground-truth file on every run — accuracy is
                        measured exactly, not estimated.
                    </p>
                </Section>

                <Section title="2. Confidence scoring">
                    <p>
                        Confidence is not a fixed value per status — it's computed per-record
                        from how far that record's deviation sits from its tolerance boundary.
                        A borderline case scores lower than an unambiguous one, on purpose:
                        confidence reflects certainty in the classification, not likelihood of
                        being "correct."
                    </p>
                    <Formula>clean_match: 100 − (amount deviation ÷ ₹50) × 40, floored at 60</Formula>
                    <Formula>partial_payment: 60 → 99 as the shortfall moves further past the ₹50 tolerance</Formula>
                    <Formula>fee_deduction_err / tds_gst_mismatch: 65 → 99 as the arithmetic deviation moves further past ±₹1</Formula>
                    <Formula>timing_gap: 90 → 55 as the date gap moves from T+2 toward the outer 14-day window</Formula>
                    <p>
                        duplicate (95) and unmatched (90) are fixed, since those are structural
                        findings, not graduated judgments. Phantom records (no counterpart at
                        all) score 50 — always flagged for manual review regardless of
                        magnitude.
                    </p>
                </Section>

                <Section title="3. Q&A retrieval and citation">
                    <p>
                        The Ask agent retrieves the most relevant records for a question,
                        then answers using only that retrieved context — never from
                        general knowledge. Every factual claim must cite a specific
                        order_id in <code className="num text-ink-primary">[order_XXXXXX]</code> format;
                        citations are validated against what was actually retrieved
                        before being shown to the user.
                    </p>
                    <p>
                        If the retrieved records don't support a confident answer, the
                        agent refuses explicitly rather than guessing — this is enforced
                        in the prompt, and checked again by validating that every cited
                        ID is one the agent actually retrieved.
                    </p>
                </Section>

                <Section title="4. Live numbers">
                    <p>Pulled from the running backend, not hardcoded:</p>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <div className="panel p-3">
                            <div className="text-xs text-ink-faint">Match rate</div>
                            <div className="num text-xl text-brass mt-1">
                                {summary ? `${(summary.match_rate * 100).toFixed(1)}%` : "…"}
                            </div>
                        </div>
                        <div className="panel p-3">
                            <div className="text-xs text-ink-faint">Total records</div>
                            <div className="num text-xl text-ink-primary mt-1">
                                {summary ? summary.total_records : "…"}
                            </div>
                        </div>
                        <div className="panel p-3">
                            <div className="text-xs text-ink-faint">Q&A refusal rate</div>
                            <div className="num text-xl text-ink-primary mt-1">
                                {auditStats
                                    ? `${Math.round(
                                        ((auditStats.refused + auditStats.outage_fallback) /
                                            Math.max(
                                                auditStats.answered + auditStats.refused + auditStats.outage_fallback,
                                                1
                                            )) *
                                        100
                                    )}%`
                                    : "…"}
                            </div>
                        </div>
                        <div className="panel p-3">
                            <div className="text-xs text-ink-faint">Exception types tracked</div>
                            <div className="num text-xl text-ink-primary mt-1">
                                {summary ? Object.keys(summary.breakdown).length - 1 : "…"}
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-ink-faint mt-2">
                        Q&A refusal rate reflects the last 200 audit-log entries from
                        this environment, not a lifetime statistic — a fresh demo with
                        few questions asked will show 0%.
                    </p>
                </Section>
            </motion.div>
        </div>
    );
}