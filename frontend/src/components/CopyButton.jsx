import { useState } from "react";

export default function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="ml-1.5 text-ink-faint hover:text-brass transition-colors"
      aria-label="Copy to clipboard"
    >
      {copied ? "✓" : "⧉"}
    </button>
  );
}