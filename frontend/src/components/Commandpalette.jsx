import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

const COMMANDS = [
  { label: "Dashboard", hint: "Reconciliation records", to: "/dashboard" },
  { label: "Ask the ledger", hint: "Q&A grounded in real records", to: "/ask" },
  { label: "Audit trail", hint: "Every agent decision, logged", to: "/audit" },
  { label: "Confidence check", hint: "Calibration against ground truth", to: "/calibration" },
  { label: "Trend across cycles", hint: "Match rate over time", to: "/trend" },
  { label: "Home", hint: "Landing page", to: "/" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const filtered = COMMANDS.filter(
    (c) =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.hint.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (modifier && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  const go = (to) => {
    setOpen(false);
    navigate(to);
  };

  const handleKeyNav = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      go(filtered[activeIndex].to);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-bg/70 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="panel w-full max-w-lg overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyNav}
          placeholder="Jump to a page…"
          className="w-full bg-transparent px-5 py-4 text-sm text-ink-primary placeholder:text-ink-faint outline-none border-b border-rule-soft"
        />
        <div className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <div className="px-5 py-4 text-sm text-ink-faint">No matches.</div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.to}
              onClick={() => go(cmd.to)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full flex items-center justify-between px-5 py-2.5 text-left transition-colors ${
                i === activeIndex ? "bg-panel-raised" : ""
              }`}
            >
              <span className={`text-sm ${i === activeIndex ? "text-brass" : "text-ink-primary"}`}>
                {cmd.label}
              </span>
              <span className="text-xs text-ink-faint">{cmd.hint}</span>
            </button>
          ))}
        </div>
        <div className="border-t border-rule-soft px-5 py-2.5 flex items-center gap-4 text-[11px] text-ink-faint">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}