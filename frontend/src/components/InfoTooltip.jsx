export default function InfoTooltip({ text, side = "top" }) {
  if (!text) return null;
  const positionClasses =
    side === "bottom" ? "top-full mt-2" : "bottom-full mb-2";
  return (
    <span className="relative inline-flex items-center group ml-1.5">
      <span className="h-3.5 w-3.5 rounded-full border border-rule text-ink-faint text-[10px] leading-[13px] text-center cursor-help select-none">
        i
      </span>
      <span
        className={`pointer-events-none absolute left-1/2 ${positionClasses} w-56 -translate-x-1/2 rounded-md border border-rule bg-panel-raised px-3 py-2 text-xs text-ink-muted opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 z-10`}
      >
        {text}
      </span>
    </span>
  );
}