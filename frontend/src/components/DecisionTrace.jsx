import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DECISION_TRACE_STEPS = {
  clean_match: [
    "Checked for an exact UTR match between settlement and bank statement",
    "Compared bank credit amount against settlement net amount",
    "Amount within tolerance — no exception triggered",
  ],
  duplicate: [
    "Checked this order_id against every settlement entry",
    "Found more than one settlement row for this order_id",
    "Structural check, not graduated — flagged regardless of amount",
  ],
  tds_gst_mismatch: [
    "Confirmed exact UTR match with the bank statement",
    "Compared TDS deducted against the expected 1% (Sec 194-O) calculation",
    "Deviation exceeded the expected TDS — flagged as mismatch",
  ],
  fee_deduction_err: [
    "Confirmed exact UTR match with the bank statement",
    "Compared fee + tax total against the expected 2% + GST calculation",
    "Deviation exceeded the expected fee — flagged as error",
  ],
  timing_gap: [
    "Confirmed exact UTR match with the bank statement",
    "Compared the bank credit date against the settlement matching window",
    "Credit date fell outside the window — flagged as timing gap",
  ],
  partial_payment: [
    "Confirmed exact UTR match with the bank statement",
    "Compared bank credit amount against settlement net amount",
    "Shortfall exceeded the ₹50 tolerance — flagged as partial payment",
  ],
  phantom_bank: [
    "Checked for a corresponding settlement record",
    "No matching settlement entry found for this order",
    "Flagged for manual review — always flagged, regardless of magnitude",
  ],
  phantom_ledger: [
    "Checked for a corresponding ledger invoice",
    "No matching ledger entry found for this order",
    "Flagged for manual review — always flagged, regardless of magnitude",
  ],
  unmatched: [
    "Checked against every deterministic rule above",
    "No rule matched this record",
    "Flagged as unmatched — fallback classification",
  ],
};

export default function DecisionTrace({ status, confidence }) {
  const [open, setOpen] = useState(false);
  const steps = DECISION_TRACE_STEPS[status];

  return (
    <div className="mb-8">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-ink-muted hover:text-brass transition-colors inline-flex items-center gap-1"
      >
        {open ? "Hide" : "View"} decision trace
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2 }}>
          →
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="panel p-4 mt-3 max-w-md">
              {steps ? (
                <ol className="space-y-2">
                  {steps.map((step, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.08 }}
                      className="flex items-start gap-2.5 text-xs text-ink-muted"
                    >
                      <span className="num flex items-center justify-center h-4 w-4 rounded-full border border-rule text-ink-faint text-[9px] shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </motion.li>
                  ))}
                  <motion.li
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: steps.length * 0.08 }}
                    className="flex items-start gap-2.5 text-xs pt-2 border-t border-rule-soft mt-2"
                  >
                    <span className="num flex items-center justify-center h-4 w-4 rounded-full border border-brass/40 text-brass text-[9px] shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span className="text-brass font-medium">
                      Confidence score: {confidence}
                    </span>
                  </motion.li>
                </ol>
              ) : (
                <p className="text-xs text-ink-faint">
                  No decision trace defined for this status.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}