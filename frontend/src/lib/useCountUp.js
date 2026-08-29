import { useEffect, useState, useRef } from "react";

export default function useCountUp(target, { duration = 900, decimals = 0 } = {}) {
  const [value, setValue] = useState(0);
  const frame = useRef(null);
  const startTime = useRef(null);

  useEffect(() => {
    if (target == null || Number.isNaN(target)) return;
    startTime.current = null;

    const step = (timestamp) => {
      if (startTime.current === null) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(target * eased);
      if (progress < 1) {
        frame.current = requestAnimationFrame(step);
      } else {
        setValue(target);
      }
    };

    frame.current = requestAnimationFrame(step);
    return () => frame.current && cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return Number(value.toFixed(decimals));
}