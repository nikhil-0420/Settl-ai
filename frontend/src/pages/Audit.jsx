import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { relativeTime } from "../lib/relativeTime.js";

const EVENT_COLOR = {
  matched: "text-settle-match",
  escalated: "text-settle-critical",
  answered: "text-brass",
  refused: "text-ink-muted",
  manual_resolution: "text-settle-match",
  outage_fallback: "text-settle-critical",
};

const EVENT_BORDER = {
  matched: "#6FBF8B",
  escalated: "#E0665A",
  answered: "#D4A94F",
  refused: "#8891A6",
  manual_resolution: "#6FBF8B",
  outage_fallback: "#E0665A",
};

export default function Audit() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .auditLog()
      .then((data) => setEntries(data.entries || data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Audit trail</h1>
      <p className="text-ink-muted mt-1">
        Every agent decision — matched, escalated, answered, or refused — logged with timestamp and reasoning.
      </p>

      {error && (
        <div className="panel p-4 mt-8 border-settle-critical/40 text-settle-critical text-sm">
          Couldn't reach the API: {error}
        </div>
      )}

      <div className="panel mt-8 divide-y divide-rule-soft">
        {loading ? (
          <div className="px-5 py-10 text-center text-ink-faint">Loading audit log…</div>
        ) : entries.length === 0 ? (
          <div className="px-5 py-10 text-center text-ink-faint">No entries logged yet.</div>
        ) : (
          entries.map((entry, i) => (
            <div
              key={i}
              className="px-5 py-4 flex items-start gap-4 border-l-2"
              style={{ borderLeftColor: EVENT_BORDER[entry.event_type] || "#8891A6" }}
            >
              <span className="num text-xs text-ink-faint w-40 shrink-0 pt-0.5" title={entry.timestamp}>
                {relativeTime(entry.timestamp)}
              </span>
              <span
                className={`inline-block text-xs uppercase tracking-wide font-medium w-40 shrink-0 pt-0.5 truncate ${EVENT_COLOR[entry.event_type] || "text-ink-muted"
                  }`}
              >
                {entry.event_type}
              </span>
              <div className="flex-1 min-w-0">
                {entry.question && (
                  <div className="text-sm text-ink-primary truncate">{entry.question}</div>
                )}
                {entry.detail && (
                  <div className="text-xs text-ink-faint mt-1 truncate">{entry.detail}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
