import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

// Repurposed from KokonutUI's language-greeting demo: same cycling
// mechanism, adapted to cycle through Settl.ai's actual capabilities
// instead of demo greetings, and restyled to the ledger token system.
const PHRASES = [
  "Match, deterministically.",
  "Flag, with a reason.",
  "Answer, with a citation.",
  "Resolve, with a note.",
];

export default function DynamicText({ className = "" }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % PHRASES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`relative h-8 overflow-visible ${className}`}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={index}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="absolute inset-0 flex items-center gap-2 text-ink-muted"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-brass" />
          {PHRASES[index]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}