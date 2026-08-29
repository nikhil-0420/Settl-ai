export default function StatCard({ label, value, sublabel, accent = false }) {
  return (
    <div className="panel p-5">
      <div className="text-xs uppercase tracking-wider text-ink-muted mb-2">{label}</div>
      <div className={`num text-3xl font-semibold ${accent ? "text-brass" : "text-ink-primary"}`}>
        {value}
      </div>
      {sublabel && <div className="text-xs text-ink-faint mt-1.5">{sublabel}</div>}
    </div>
  );
}
