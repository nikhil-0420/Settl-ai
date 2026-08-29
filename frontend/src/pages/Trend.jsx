import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { api } from "../lib/api.js";
import { motion } from "framer-motion";

const EXCEPTION_COLORS = {
  duplicate: "#8891A6",
  tds_gst_mismatch: "#E0665A",
  timing_gap: "#D4A94F",
  partial_payment: "#5B9BD5",
  fee_deduction_err: "#C77DBA",
  phantom_bank: "#6FBF8B",
  phantom_ledger: "#4FA5A0",
};

export default function Trend() {
  const [cycles, setCycles] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .trend()
      .then((data) => setCycles(data.cycles || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const matchRateData = cycles?.map((c) => ({
    cycle: c.cycle,
    date: c.date,
    matchRate: Math.round(c.match_rate * 1000) / 10,
  }));

  const breakdownData = cycles?.map((c) => ({
    cycle: c.cycle,
    date: c.date,
    ...c.breakdown,
  }));

  const exceptionKeys = cycles?.length
    ? Object.keys(cycles[cycles.length - 1].breakdown).filter((k) => k !== "clean_match")
    : [];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Trend across cycles</h1>
      <p className="text-ink-muted mt-1 max-w-2xl leading-relaxed">
        Match rate and exception breakdown across the last 5 settlement cycles.
        The most recent cycle reflects the live matcher output above — the
        four before it are illustrative historical data, seeded with a
        realistic TDS/GST anomaly to show how a rate-change-shaped spike
        would surface and taper.
      </p>

      <div className="panel p-4 mt-6 border-[#5B8DEF]/30 text-xs text-ink-muted leading-relaxed">
        <strong className="text-[#8FB3F5]">Honest framing:</strong> cycles 1–4
        are synthetic, generated to demonstrate the trend view — they were
        never run through the matcher against real settlement/bank/ledger
        data, so there's no record-level drill-down for them. Only the
        current cycle (the rightmost point) is live.
      </div>

      {error && (
        <div className="panel p-4 mt-8 border-settle-critical/40 text-settle-critical text-sm">
          Couldn't reach the API: {error}
        </div>
      )}

      {loading && <p className="text-ink-faint mt-8">Loading trend…</p>}

      {matchRateData && (
        <motion.div
          className="panel p-5 mt-8"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.4 }}
        >
          <h3 className="font-display font-semibold text-sm mb-4">Match rate over time</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={matchRateData}>
              <CartesianGrid stroke="#24304A" />
              <XAxis dataKey="cycle" tick={{ fill: "#8891A6", fontSize: 11 }} stroke="#24304A" />
              <YAxis
                domain={[60, 90]}
                unit="%"
                tick={{ fill: "#8891A6", fontSize: 11 }}
                stroke="#24304A"
              />
              <Tooltip
                contentStyle={{ background: "#172239", border: "1px solid #24304A" }}
                labelStyle={{ color: "#EDEFF4" }}
              />
              <Line
                type="monotone"
                dataKey="matchRate"
                name="Match rate (%)"
                stroke="#D4A94F"
                strokeWidth={2}
                dot={(props) => {
                  const isLast = props.index === matchRateData.length - 1;
                  return isLast ? (
                    <g key={props.key}>
                      <circle cx={props.cx} cy={props.cy} r={8} fill="#D4A94F" opacity={0.25}>
                        <animate attributeName="r" values="6;11;6" dur="1.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.35;0.1;0.35" dur="1.8s" repeatCount="indefinite" />
                      </circle>
                      <circle cx={props.cx} cy={props.cy} r={4} fill="#D4A94F" />
                    </g>
                  ) : (
                    <circle key={props.key} cx={props.cx} cy={props.cy} r={4} fill="#D4A94F" />
                  );
                }}
                animationDuration={1400}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {breakdownData && (
        <motion.div
          className="panel p-5 mt-6"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.4 }}
        >
          <h3 className="font-display font-semibold text-sm mb-4">Exception breakdown over time</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={breakdownData}>
              <CartesianGrid stroke="#24304A" />
              <XAxis dataKey="cycle" tick={{ fill: "#8891A6", fontSize: 11 }} stroke="#24304A" />
              <YAxis tick={{ fill: "#8891A6", fontSize: 11 }} stroke="#24304A" />
              <Tooltip
                contentStyle={{ background: "#172239", border: "1px solid #24304A" }}
                labelStyle={{ color: "#EDEFF4" }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#8891A6" }} />
              {exceptionKeys.map((key) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={key.replace(/_/g, " ")}
                  stackId="1"
                  stroke={EXCEPTION_COLORS[key] || "#8891A6"}
                  fill={EXCEPTION_COLORS[key] || "#8891A6"}
                  fillOpacity={0.5}
                  animationDuration={1000}
                  animationBegin={exceptionKeys.indexOf(key) * 120}
                  animationEasing="ease-out"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {cycles && cycles.length > 0 && (
        <motion.div
          className="panel mt-6 relative"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.4 }}
        >
          <h3 className="font-display font-semibold text-sm px-5 pt-5 mb-2">Cycle details</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="border-b border-rule text-left text-xs uppercase tracking-wider text-ink-faint">
                  <th className="sticky left-0 bg-panel px-5 py-3 font-medium">Cycle</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium text-right">Total</th>
                  <th className="px-5 py-3 font-medium text-right">Match rate</th>
                  {Object.keys(cycles[cycles.length - 1].breakdown).map((key) => (
                    <th key={key} className="px-5 py-3 font-medium text-right">
                      {key.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cycles.map((c) => (
                  <tr
                    key={c.cycle}
                    className="border-b border-rule-soft last:border-b-0 hover:bg-panel-raised transition-colors"
                  >
                    <td className="sticky left-0 bg-panel px-5 py-3 num text-ink-primary">{c.cycle}</td>
                    <td className="px-5 py-3 num text-ink-muted">{c.date}</td>
                    <td className="px-5 py-3 num text-right text-ink-primary">{c.total_records}</td>
                    <td className="px-5 py-3 num text-right text-brass">
                      {(c.match_rate * 100).toFixed(1)}%
                    </td>
                    {Object.keys(cycles[cycles.length - 1].breakdown).map((key) => (
                      <td key={key} className="px-5 py-3 num text-right text-ink-muted">
                        {c.breakdown[key] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-panel to-transparent" />
        </motion.div>
      )}
    </div>
  );
}