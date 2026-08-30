import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../lib/api.js";
import TiltCard from "../components/TiltCard.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

const TEMPLATES = {
  settlement: {
    filename: "settlement_report.csv",
    label: "Settlement report",
    headers: "settlement_id,payment_id,order_id,amount,fee,tax,tds,net_amount,settled_at,utr,method",
  },
  bank: {
    filename: "bank_statement.csv",
    label: "Bank statement",
    headers: "utr,credit_amount,value_date,narration",
  },
  ledger: {
    filename: "internal_ledger.csv",
    label: "Internal ledger",
    headers: "order_id,invoice_id,expected_amount,invoice_date,status",
  },
};

const RUNS_KEY = "settl_upload_runs";

function loadStoredRuns() {
  try {
    const raw = sessionStorage.getItem(RUNS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

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

function downloadTemplate(key) {
  const { filename, headers } = TEMPLATES[key];
  const blob = new Blob([headers + "\n"], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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

function FileSlot({ slotKey, file, onChange }) {
  const meta = TEMPLATES[slotKey];
  return (
    <div className="panel p-4">
      <div className="mb-3">
        <span className="text-xs uppercase tracking-wider text-ink-faint block">{meta.label}</span>
        <button
          onClick={() => downloadTemplate(slotKey)}
          className="text-xs text-brass hover:text-brass-soft mt-1"
        >
          Download template
        </button>
      </div>
      <label className="flex items-center justify-center border border-dashed border-rule rounded-md h-20 cursor-pointer hover:border-brass transition-colors">
        <input
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => onChange(slotKey, e.target.files[0] || null)}
        />
        <span className="text-xs text-ink-muted text-center px-3">
          {file ? file.name : "Click to choose a CSV"}
        </span>
      </label>
    </div>
  );
}

function RunResult({ run, isLatest }) {
  const { result, timestamp } = run;
  const [filterStatus, setFilterStatus] = useState(null);

  const breakdownData = Object.entries(result.breakdown).map(([key, val]) => ({
    status: key.replace(/_/g, " "),
    count: val.count,
    fill: RECORD_COLORS[key] || "#8891A6",
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-6"
    >
      <div className="text-xs text-ink-faint mb-3">
        {isLatest ? "Latest run" : "Run"} — {new Date(timestamp).toLocaleString()}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <TiltCard>
          <StatCard label="Match rate" value={`${(result.match_rate * 100).toFixed(1)}%`} accent />
        </TiltCard>
        <TiltCard>
          <StatCard label="Total records" value={result.total_records} />
        </TiltCard>
        <TiltCard>
          <StatCard label="Clean matches" value={result.breakdown.clean_match?.count ?? 0} />
        </TiltCard>
        <TiltCard>
          <StatCard
            label="Exceptions"
            value={result.total_records - (result.breakdown.clean_match?.count ?? 0)}
          />
        </TiltCard>
      </div>

      <TiltCard>
        <div className="panel p-5">
          <h3 className="font-display font-semibold text-sm mb-4">Breakdown</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={breakdownData} margin={{ bottom: 10 }}>
              <CartesianGrid stroke="#24304A" />
              <XAxis
                dataKey="status"
                tick={{ fill: "#8891A6", fontSize: 11 }}
                stroke="#24304A"
                interval={0}
                angle={-25}
                textAnchor="end"
                height={50}
              />
              <YAxis tick={{ fill: "#8891A6", fontSize: 11 }} stroke="#24304A" />
              <Tooltip cursor={{ fill: "rgba(137,145,166,0.08)" }} content={<BarTooltip />} />
              <Bar dataKey="count" background={{ fill: "transparent" }} animationDuration={800}>
                {breakdownData.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </TiltCard>

      <TiltCard strength={1.5}>
        <div className="panel p-5 mt-6">
          <div className="mb-4">
            <h3 className="font-display font-semibold text-sm mb-3">Records</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterStatus(null)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  !filterStatus ? "border-brass text-brass" : "border-rule text-ink-muted hover:border-ink-muted"
                }`}
              >
                All ({result.records.length})
              </button>
              {Object.entries(result.breakdown).map(([status, val]) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    filterStatus === status ? "border-brass text-brass" : "border-rule text-ink-muted hover:border-ink-muted"
                  }`}
                >
                  {status.replace(/_/g, " ")} ({val.count})
                </button>
              ))}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule-soft text-left">
                <th className="pb-2 font-medium text-ink-faint text-xs uppercase tracking-wider">Order ID</th>
                <th className="pb-2 font-medium text-ink-faint text-xs uppercase tracking-wider">Status</th>
                <th className="pb-2 font-medium text-ink-faint text-xs uppercase tracking-wider text-right">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {result.records
                .filter((r) => !filterStatus || r.status === filterStatus)
                .map((r, i) => (
                  <tr key={r.order_id || r.utr || i} className="border-b border-rule-soft last:border-b-0">
                    <td className="num py-2.5 text-ink-primary">{r.order_id || r.utr || "—"}</td>
                    <td className="py-2.5"><StatusBadge status={r.status} /></td>
                    <td className="num py-2.5 text-right text-ink-muted">{r.confidence}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </TiltCard>

      <div className="panel p-3 mt-4 border-[#5B8DEF]/30 text-xs text-ink-muted leading-relaxed">
        <strong className="text-[#8FB3F5]">Honest framing:</strong> this run
        is isolated to your uploaded data — it doesn't write to or affect the
        main dashboard or demo dataset in any way. Record detail pages aren't
        available for this run since the underlying files are discarded
        immediately after processing.
      </div>
    </motion.div>
  );
}

export default function LiveUpload() {
  const [files, setFiles] = useState({ settlement: null, bank: null, ledger: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [runs, setRuns] = useState(loadStoredRuns);

  const allSelected = files.settlement && files.bank && files.ledger;

  const handleFileChange = (slotKey, file) => {
    setFiles((prev) => ({ ...prev, [slotKey]: file }));
  };

  useEffect(() => {
    try {
      sessionStorage.setItem(RUNS_KEY, JSON.stringify(runs));
    } catch {
      // ignore storage errors
    }
  }, [runs]);

  const submit = async () => {
    if (!allSelected || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.uploadReconcile(files);
      setRuns((prev) => [{ id: Date.now(), timestamp: new Date().toISOString(), result: data }, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearRuns = () => {
    setRuns([]);
    sessionStorage.removeItem(RUNS_KEY);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Run it on your own data</h1>
      <p className="text-ink-muted mt-1 max-w-2xl leading-relaxed">
        Upload a settlement report, bank statement, and internal ledger — the
        real matcher runs against them live, in an isolated space that never
        touches the demo dataset. Download the templates below to match the
        expected schema exactly.
      </p>

      <div className="grid md:grid-cols-3 gap-4 mt-8">
        <FileSlot slotKey="settlement" file={files.settlement} onChange={handleFileChange} />
        <FileSlot slotKey="bank" file={files.bank} onChange={handleFileChange} />
        <FileSlot slotKey="ledger" file={files.ledger} onChange={handleFileChange} />
      </div>

      <div className="flex justify-end mt-5">
        <button
          onClick={submit}
          disabled={!allSelected || loading}
          className="px-5 py-2.5 rounded-full bg-brass text-bg font-medium text-sm hover:bg-brass-soft transition-colors disabled:opacity-40"
        >
          {loading ? "Running matcher…" : "Run reconciliation"}
        </button>
      </div>

      {error && (
        <div className="panel p-4 mt-6 border-settle-critical/40 text-settle-critical text-sm">
          {error}
        </div>
      )}

      {runs.length > 0 && (
        <div className="flex justify-between items-center mt-10 mb-4">
          <h2 className="text-sm text-ink-faint uppercase tracking-wider">
            {runs.length} run{runs.length > 1 ? "s" : ""} this session
          </h2>
          <button
            onClick={clearRuns}
            className="text-xs px-3 py-1.5 rounded-full border border-rule text-ink-muted hover:border-settle-critical hover:text-settle-critical transition-colors"
          >
            Clear history
          </button>
        </div>
      )}

      {runs.map((run, i) => (
        <RunResult key={run.id} run={run} isLatest={i === 0} />
      ))}
    </div>
  );
}