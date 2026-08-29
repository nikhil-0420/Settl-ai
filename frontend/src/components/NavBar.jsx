import { NavLink, useLocation } from "react-router-dom";
import { useRef, useEffect, useState } from "react";
import { SettlMark } from "../components/SettlMark.jsx";


const LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/ask", label: "Ask" },
  { to: "/audit", label: "Audit trail" },
  { to: "/calibration", label: "Confidence check" },
  { to: "/trend", label: "Trend" },
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
    <header className="sticky top-0 z-40 border-b border-rule bg-bg/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
        <NavLink to="/" className="flex items-center gap-2.5 group">
          <SettlMark size={26} />
          <span className="font-display font-semibold text-xl tracking-tight">
            Settl<span className="text-brass">.ai</span>
          </span>
        </NavLink>
        <nav ref={navRef} className="relative flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none">
          <span
            className="absolute bottom-0 h-0.5 bg-brass transition-all duration-200 ease-out"
            style={{ left: indicator.left, width: indicator.width }}
          />
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `px-2 sm:px-3 py-2 text-xs sm:text-sm rounded-md transition-colors whitespace-nowrap ${isActive
                  ? "text-brass bg-panel-raised"
                  : "text-ink-muted hover:text-ink-primary hover:bg-panel-raised"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
