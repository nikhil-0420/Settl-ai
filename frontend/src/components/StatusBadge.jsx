const STATUS_CONFIG = {
  clean_match: { label: "Clean match", color: "text-settle-match", dot: "bg-settle-match" },
  timing_gap: { label: "Timing gap", color: "text-settle-warn", dot: "bg-settle-warn" },
  partial_payment: { label: "Partial payment", color: "text-settle-warn", dot: "bg-settle-warn" },
  fee_deduction_err: { label: "Fee deduction error", color: "text-settle-critical", dot: "bg-settle-critical" },
  tds_gst_mismatch: { label: "TDS/GST mismatch", color: "text-settle-critical", dot: "bg-settle-critical" },
  duplicate: { label: "Duplicate", color: "text-brass", dot: "bg-brass" },
  phantom_bank: { label: "Phantom bank credit", color: "text-settle-critical", dot: "bg-settle-critical" },
  phantom_ledger: { label: "Phantom ledger entry", color: "text-settle-critical", dot: "bg-settle-critical" },
  ledger_missing: { label: "Ledger entry missing", color: "text-settle-critical", dot: "bg-settle-critical" },
  ledger_mismatch: { label: "Ledger amount mismatch", color: "text-settle-critical", dot: "bg-settle-critical" },
  unmatched: { label: "Unmatched", color: "text-ink-muted", dot: "bg-ink-muted" },
};

export default function StatusBadge({ status, size = "md" }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "text-ink-muted", dot: "bg-ink-muted" };
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-rule bg-panel-raised font-mono ${sizeClasses} ${cfg.color}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
