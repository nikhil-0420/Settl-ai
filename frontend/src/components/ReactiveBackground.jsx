import { useEffect, useRef } from "react";

// Circuit/network mesh: a grid of faint nodes connected by proximity lines,
// reinforcing "ledger network" over a generic dark-SaaS gradient. The
// cursor gently pulls nearby nodes toward it and lights them up in brass.
const DOT_COLOR = "#4A5178";
const BRASS = "#D4A94F";
const GRID_SPACING = 52;
const CONNECT_DIST = 58;
const HOVER_DIST = 120;
const PULL_STRENGTH = 16;
const EASE = 0.15;

export default function ReactiveBackground() {
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let dpr = 1;

    const buildNodes = () => {
      const cols = Math.max(2, Math.round(width / GRID_SPACING));
      const rows = Math.max(2, Math.round(height / GRID_SPACING));
      const nodes = [];
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const bx = (i + 0.5) * (width / cols);
          const by = (j + 0.5) * (height / rows);
          nodes.push({ bx, by, x: bx, y: by });
        }
      }
      nodesRef.current = nodes;
    };

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildNodes();
    };

    const handleMove = (e) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };
    const handleLeave = () => {
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    };

    const draw = () => {
      const { x: mx, y: my } = mouseRef.current;
      const nodes = nodesRef.current;

      ctx.clearRect(0, 0, width, height);

      for (const n of nodes) {
        const dx = n.bx - mx;
        const dy = n.by - my;
        const dist = Math.hypot(dx, dy);
        const force = Math.max(0, 1 - dist / HOVER_DIST);
        const tx = n.bx + (dx / (dist || 1)) * force * PULL_STRENGTH;
        const ty = n.by + (dy / (dist || 1)) * force * PULL_STRENGTH;
        n.x += (tx - n.x) * EASE;
        n.y += (ty - n.y) * EASE;
      }

      ctx.strokeStyle = DOT_COLOR;
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < CONNECT_DIST) {
            ctx.globalAlpha = 0.25 * (1 - d / CONNECT_DIST);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        const dist = Math.hypot(n.bx - mx, n.by - my);
        const near = dist < HOVER_DIST;
        ctx.beginPath();
        ctx.arc(n.x, n.y, near ? 2.0 : 1.3, 0, Math.PI * 2);
        ctx.fillStyle = near ? BRASS : DOT_COLOR;
        ctx.globalAlpha = near ? 0.65 : 0.45;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseleave", handleLeave);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseleave", handleLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none"
    />
  );
}