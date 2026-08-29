import { useEffect, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import TiltCard from "../components/TiltCard.jsx";

// Reads the static output of app/calibration.py — copy
// confidence_severity_validation.json into frontend/public/ as part of the
// build/deploy step so this page has data to render.
export default function Calibration() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/confidence_severity_validation.json")
      .then((res) => {
        if (!res.ok) throw new Error("validation file not found");
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Confidence, checked</h1>
      <p className="text-ink-muted mt-1 max-w-2xl leading-relaxed">
        A standard calibration curve (confidence vs. accuracy) doesn't apply
        here — the matcher is 100% accurate against ground truth, so every
        bucket would trivially show 100%. Instead, this checks whether
        confidence actually tracks the real, recomputed deviation behind each
        record — a bigger fee error or a longer settlement delay should move
        confidence in the expected direction.
      </p>

      <div className="panel p-4 mt-6 border-[#5B8DEF]/30 text-xs text-ink-muted leading-relaxed">
        <strong className="text-[#8FB3F5]">Honest framing:</strong> this is an
        internal consistency check across 3 deterministic severity tiers per
        status — it confirms the formula doesn't invert its own intended
        ordering. With n=3 per status, the correlation isn't a statistically
        powered claim, and the check is close to tautological since both
        quantities derive from the same underlying deviation via a monotonic
        transform.
      </div>

      {error && (
        <div className="panel p-4 mt-8 border-settle-critical/40 text-settle-critical text-sm">
          {error}. Run <code className="num">python app/calibration.py</code>{" "}
          and copy the output JSON into <code className="num">frontend/public/</code>.
        </div>
      )}

      {data && (
        <div className="grid md:grid-cols-2 gap-6 mt-8">
          {Object.entries(data).map(([status, result], i) => (
            <motion.div
              key={status}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <TiltCard>
                <StatusChart status={status} result={result} />
              </TiltCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusChart({ status, result }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-sm">
          {status.replace(/_/g, " ")}
        </h3>
        {result.matches_expected != null && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${result.matches_expected
              ? "border-settle-match/40 text-settle-match"
              : "border-settle-critical/40 text-settle-critical"
              }`}
          >
            {result.matches_expected ? "Direction holds" : "Direction inverted"}
          </span>
        )}
      </div>
      <div className="text-xs text-ink-muted mb-3">
        n={result.n} · Spearman ρ = {result.correlation ?? "n/a"} · expected{" "}
        {result.expected_direction}
      </div>
      {result.plot ? (
        <ResponsiveContainer width="100%" height={200}>
          <ScatterChart>
            <CartesianGrid stroke="#24304A" />
            <XAxis
              dataKey="deviation"
              name="deviation"
              tick={{ fill: "#8891A6", fontSize: 11 }}
              stroke="#24304A"
            />
            <YAxis
              dataKey="confidence"
              name="confidence"
              tick={{ fill: "#8891A6", fontSize: 11 }}
              stroke="#24304A"
            />
            <Tooltip
              contentStyle={{ background: "#172239", border: "1px solid #24304A" }}
              labelStyle={{ color: "#EDEFF4" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <div className="bg-panel-raised border border-rule rounded-md px-3 py-2 text-xs">
                    <div className="num text-brass">{p.order_id}</div>
                    <div className="text-ink-muted mt-1">deviation: {p.deviation}</div>
                    <div className="text-ink-muted">confidence: {p.confidence}</div>
                  </div>
                );
              }}
            />
            <Scatter data={result.plot} fill="#D4A94F" />
          </ScatterChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-xs text-ink-muted">
          {result.note || "No chart data available for this status."}
        </p>
      )}
    </div>
  );
}
