import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function TextGenerateEffect({ words, className = "" }) {
  const wordList = words.split(" ");
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    const interval = setInterval(() => {
      setVisibleCount((c) => {
        if (c >= wordList.length) {
          clearInterval(interval);
          return c;
        }
        return c + 1;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [words]);

  return (
    <div className={className}>
      {wordList.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, filter: "blur(6px)" }}
          animate={i < visibleCount ? { opacity: 1, filter: "blur(0px)" } : {}}
          transition={{ duration: 0.3 }}
          className="inline-block mr-[0.25em]"
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
}