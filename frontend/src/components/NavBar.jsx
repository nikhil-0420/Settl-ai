import { NavLink, useLocation } from "react-router-dom";
import { useRef, useEffect, useState } from "react";
import { SettlMark } from "../components/SettlMark.jsx";

const LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/ask", label: "Ask" },
  { to: "/audit", label: "Audit trail" },
  { to: "/calibration", label: "Confidence check" },
  { to: "/trend", label: "Trend" },
  { to: "/appendix", label: "How it works" },
  { to: "/upload", label: "Try your data" },
];

export default function NavBar() {
  const location = useLocation();
  const navRef = useRef(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const activeEl = navRef.current?.querySelector('[aria-current="page"]');
    if (activeEl) {
      setIndicator({ left: activeEl.offsetLeft, width: activeEl.offsetWidth });
    }
  }, [location.pathname]);

  return (
    <>
      {/* Logo + nav pill float together as a centered group — positioning only,
          not visually merged: logo has no background/border of its own. */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4">
        <NavLink to="/" className="flex items-center gap-2.5 group shrink-0">
          <SettlMark size={26} />
          <span className="font-display font-semibold text-xl tracking-tight hidden sm:inline">
            Settl<span className="text-brass">.ai</span>
          </span>
        </NavLink>

        <nav
          ref={navRef}
          className="relative inline-flex w-fit items-center gap-0.5 px-1.5 py-1.5 rounded-full border border-rule-soft bg-panel/80 backdrop-blur-md shadow-lg shadow-black/20 overflow-x-auto scrollbar-none max-w-[70vw]"
        >
          <span
            className="absolute inset-y-1.5 rounded-full bg-panel-raised transition-all duration-200 ease-out"
            style={{ left: indicator.left, width: indicator.width }}
          />
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `relative px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-sm rounded-full transition-colors whitespace-nowrap ${isActive
                  ? "text-brass"
                  : "text-ink-muted hover:text-ink-primary"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Spacer — nav is now fixed/out of flow, so page content needs room below it */}
      <div className="h-14" />
    </>
  );
}