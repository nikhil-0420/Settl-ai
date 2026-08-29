import { useEffect, useState } from "react";

// The signature moment: rows sweep from unreconciled (dim, no source match)
// to matched (brass tick lands into place) — this is the product's core
// action, shown once as ambient motion rather than described in prose.
const ROWS = [
  { id: "order_200036U", label: "fee deduction error", settled: false },
  { id: "order_200017M", label: "timing gap · T+8", settled: false },
  { id: "order_200055U", label: "clean match", settled: true },
  { id: "order_200011L", label: "TDS mismatch · 1.8%", settled: false },
  { id: "order_200067U", label: "clean match", settled: true },
];

export default function LedgerSweep() {
  const [settledIndices, setSettledIndices] = useState(new Set());
  
  useEffect(() => {
    ROWS.forEach((row, i) => {
      const delay = 400 + i * 350;
      setTimeout(() => {
        setSettledIndices((prev) => new Set(prev).add(i));
      }, delay);
    });
  }, []);

   const [pulseIndex, setPulseIndex] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const settledRows = ROWS.map((_, i) => i).filter((i) => settledIndices.has(i));
      if (settledRows.length === 0) return;
      const randomRow = settledRows[Math.floor(Math.random() * settledRows.length)];
      setPulseIndex(randomRow);
      setTimeout(() => setPulseIndex(null), 900);
    }, 3500);
    return () => clearInterval(interval);
  }, [settledIndices]);
  
  return (
    <div className="panel p-1.5 w-full max-w-md">
      {ROWS.map((row, i) => {
        const isSettled = settledIndices.has(i);
        return (
          <div
            key={row.id}
            className={`flex items-center justify-between px-4 py-3 border-b border-rule-soft last:border-b-0 transition-opacity duration-500 ${isSettled ? "opacity-100" : "opacity-40"
              } ${pulseIndex === i ? "bg-brass/5" : ""}`}
            style={{ transition: "background-color 0.6s ease, opacity 0.5s" }}
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border transition-colors duration-300 ${isSettled ? "border-brass bg-brass/20" : "border-rule"
                  }`}
              >
                {isSettled && (
                  <svg
                    viewBox="0 0 12 12"
                    className="h-2.5 w-2.5 text-brass animate-tick"
                    fill="none"
                  >
                    <path
                      d="M2 6l2.5 2.5L10 3"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span className="num text-sm text-ink-primary">{row.id}</span>
            </div>
            <span className="text-xs text-ink-faint">{row.label}</span>
          </div>
        );
      })}
    </div>
  );
}
