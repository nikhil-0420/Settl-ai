// frontend/src/components/DecisionPanels.jsx
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import TiltCard from "./TiltCard.jsx";
import InfoTooltip from "./InfoTooltip.jsx";
import { api } from "../lib/api.js";

const RECORD_COLORS = {
  clean_match: "#4FBF8B",
  duplicate: "#8891A6",
  tds_gst_mismatch: "#E0665A",
  timing_gap: "#D4A94F",
  partial_payment: "#5B9BD5",
  fee_deduction_err: "#C77DBA",
  phantom_bank: "#6FBF8B",
  phantom_ledger: "#4FA5A0",
};

const OUTCOME_META = {
  answered: { label: "answered", color: "#4FBF8B" },
  refused: { label: "refused", color: "#E2685A" },
  outage_fallback: { label: "escalated", color: "#E0A73D" },
};

const chartAxisProps = {
  tick: { fill: "#8891A6", fontSize: 11 },
  stroke: "#24304A",
};

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-panel-raised border border-rule rounded-md px-3 py-2 text-xs">
      <div className="text-ink-primary font-medium mb-1">{label}</div>
      <div style={{ color: p.payload.fill }}>count : {p.value}</div>
    </div>
  );
}

export default function DecisionPanels({ summary }) {
  const [outcomes, setOutcomes] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .auditLog(200)
      .then((data) => {
        const counts = { answered: 0, refused: 0, outage_fallback: 0 };
        for (const entry of data.entries || []) {
          if (entry.event_type in counts) counts[entry.event_type] += 1;
        }
        setOutcomes(counts);
      })
      .catch((err) => setError(err.message));
  }, []);

  const recordData = summary
    ? Object.entries(summary.breakdown).map(([key, val]) => ({
        status: key.replace(/_/g, " "),
        count: val.count,
        fill: RECORD_COLORS[key] || "#8891A6",
      }))
    : null;

  const outcomeData = outcomes
    ? Object.entries(outcomes).map(([key, count]) => ({
        outcome: OUTCOME_META[key].label,
        count,
        fill: OUTCOME_META[key].color,
      }))
    : null;

  return (
    <div className="mt-12 mb-16">
      <h2 className="font-display text-xl font-semibold">How it decides</h2>
      <p className="text-ink-muted text-sm mt-1 max-w-2xl leading-relaxed">
        Two independent decision layers — records are classified
        deterministically, questions are answered or refused based on
        retrieval confidence. Neither one guesses.
      </p>

      <div className="grid md:grid-cols-2 gap-6 mt-6 items-stretch">
        <motion.div
          className="h-full"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.4 }}
        >
          <TiltCard className="h-full">
            <div className="panel p-5 h-full flex flex-col">
              <h3 className="font-display font-semibold text-sm mb-4">
                <span className="inline-flex items-center">
                  Record classification
                  <InfoTooltip
                    side="bottom"
                    text="Every record is deterministically classified against tolerance and window rules — no LLM involved."
                  />
                </span>
              </h3>
              {recordData ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={recordData} margin={{ bottom: 10 }}>
                    <CartesianGrid stroke="#24304A" />
                    <XAxis
                      dataKey="status"
                      {...chartAxisProps}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis {...chartAxisProps} />
                    <Tooltip
                      cursor={{ fill: "rgba(137,145,166,0.08)" }}
                      content={<BarTooltip />}
                    />
                    <Bar
                      dataKey="count"
                      background={{ fill: "transparent" }}
                      animationDuration={1000}
                      animationEasing="ease-out"
                    >
                      {recordData.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-ink-muted">Loading…</p>
              )}
            </div>
          </TiltCard>
        </motion.div>

        <motion.div
          className="h-full"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <TiltCard className="h-full">
            <div className="panel p-5 h-full flex flex-col">
              <h3 className="font-display font-semibold text-sm mb-4">
                <span className="inline-flex items-center">
                  Q&A agent outcomes
                  <InfoTooltip
                    side="bottom"
                    text="Answered, refused, or escalated — from the most recent questions asked to the ledger agent."
                  />
                </span>
              </h3>
              {error ? (
                <p className="text-xs text-settle-critical">
                  Couldn't load audit log: {error}
                </p>
              ) : outcomeData ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={outcomeData}>
                    <CartesianGrid stroke="#24304A" />
                    <XAxis dataKey="outcome" {...chartAxisProps} />
                    <YAxis {...chartAxisProps} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(137,145,166,0.08)" }}
                      content={<BarTooltip />}
                    />
                    <Bar
                      dataKey="count"
                      background={{ fill: "transparent" }}
                      animationDuration={1000}
                      animationEasing="ease-out"
                      animationBegin={150}
                    >
                      {outcomeData.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-ink-muted">Loading…</p>
              )}
            </div>
          </TiltCard>
        </motion.div>
      </div>

      <div className="panel p-3 mt-4 border-[#5B8DEF]/30 text-xs text-ink-muted leading-relaxed">
        <strong className="text-[#8FB3F5]">Honest framing:</strong>{" "}
        The Q&A outcomes reflect the last 200 audit-log entries, not lifetime
        totals — a fresh demo environment with few questions asked will show
        small numbers here.
      </div>
    </div>
  );
}