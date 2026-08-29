import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { api, exportUrl, CONFIDENCE_EXPLANATIONS } from "../lib/api.js";
import InfoTooltip from "../components/InfoTooltip.jsx";
import useCountUp from "../lib/useCountUp.js";
import TiltCard from "../components/TiltCard.jsx";
import { motion } from "framer-motion";
import DecisionPanels from "../components/DecisionPanels.jsx";


export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [statusFilter, setStatusFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.matchSummary(), api.records(statusFilter)])
      .then(([summaryData, recordsData]) => {
        setSummary(summaryData);
        setRecords(recordsData.records || []);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const statuses = summary ? Object.keys(summary.breakdown) : [];
  const animatedMatchRate = useCountUp(summary ? summary.match_rate * 100 : null, { decimals: 1 });
  const animatedTotal = useCountUp(summary?.total_records ?? null);
  const animatedClean = useCountUp(summary?.breakdown.clean_match?.count ?? null);
  const animatedExceptions = useCountUp(
    summary ? summary.total_records - (summary.breakdown.clean_match?.count ?? 0) : null
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">Reconciliation</h1>
            <p className="text-ink-muted mt-1">
              Every record classified against settlement, bank, and ledger sources.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <a
              href={exportUrl("csv")}
              className="text-xs px-3 py-1.5 rounded-full border border-rule text-ink-muted hover:border-brass hover:text-brass transition-colors"
            >
              Export CSV
            </a>
            <a
              href={exportUrl("pdf")}
              className="text-xs px-3 py-1.5 rounded-full border border-rule text-ink-muted hover:border-brass hover:text-brass transition-colors"
            >
              Export PDF
            </a>
          </div>
        </div>
      </div>

      {error && (
        <div className="panel p-4 mb-8 border-settle-critical/40 text-settle-critical text-sm">
          Couldn't reach the API: {error}. Confirm the backend is running and
          VITE_API_URL is set correctly.
        </div>
      )}

      {!summary && loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="panel p-5 animate-pulse">
              <div className="h-3 w-20 bg-rule rounded mb-3" />
              <div className="h-8 w-16 bg-rule rounded" />
            </div>
          ))}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <TiltCard><StatCard label="Match rate" value={`${animatedMatchRate}%`} accent /></TiltCard>
          <TiltCard><StatCard label="Total records" value={animatedTotal} /></TiltCard>
          <TiltCard><StatCard label="Clean matches" value={animatedClean} /></TiltCard>
          <TiltCard><StatCard label="Exceptions" value={animatedExceptions} /></TiltCard>
        </div>
      )}
      {summary && <DecisionPanels summary={summary} />}

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        <button
          onClick={() => setStatusFilter(null)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${!statusFilter
            ? "border-brass text-brass bg-brass/10"
            : "border-rule text-ink-muted hover:text-ink-primary"
            }`}
        >
          All
        </button>
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${statusFilter === s
              ? "border-brass text-brass bg-brass/10"
              : "border-rule text-ink-muted hover:text-ink-primary"
              }`}
          >
            {s.replace(/_/g, " ")} ({summary?.breakdown[s]?.count ?? 0})
          </button>
        ))}
      </div>

      {/* Records table */}
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-rule text-left text-xs uppercase tracking-wider text-ink-faint">
              <th className="px-5 py-3 font-medium">Order ID</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">
                <span className="inline-flex items-center justify-end">
                  Confidence
                  <InfoTooltip
                    side="bottom"
                    text="How far this record sits from its tolerance boundary — higher means less ambiguous, not more likely to be correct."
                  />
                </span>
              </th>
              <th className="px-5 py-3 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-ink-faint">
                  Loading records…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-settle-critical text-sm">
                  Couldn't load records — see the error above.
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-ink-faint">
                  No records match this filter.
                </td>
              </tr>
            ) : (
              records.map((r, i) => (
                <motion.tr
                  key={r.settlement_id || r.order_id || r.utr}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, delay: Math.min(i, 14) * 0.03 }}
                  className="border-b border-rule-soft last:border-b-0 hover:bg-panel-raised transition-colors"
                >
                  <td className="px-5 py-3 num text-ink-primary">
                    {r.order_id || <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-2">
                      <StatusBadge status={r.status} size="sm" />
                      {r.resolved && (
                        <span className="text-[10px] uppercase tracking-wide text-settle-match">
                          resolved
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-3 num text-right text-ink-muted">
                    {r.confidence != null ? `${r.confidence}` : "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {r.order_id && (
                      <Link
                        to={`/records/${r.order_id}`}
                        className="text-xs text-brass hover:text-brass-soft"
                      >
                        Inspect →
                      </Link>
                    )}
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}