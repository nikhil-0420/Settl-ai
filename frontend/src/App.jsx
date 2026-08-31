import { Routes, Route, useLocation } from "react-router-dom";
import NavBar from "./components/NavBar.jsx";
import Landing from "./pages/Landing.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import RecordDetail from "./pages/RecordDetail.jsx";
import Ask from "./pages/Ask.jsx";
import Audit from "./pages/Audit.jsx";
import Calibration from "./pages/Calibration.jsx";
import Trend from "./pages/Trend.jsx";
import ReactiveBackground from "./components/ReactiveBackground.jsx";
import CommandPalette from "./components/Commandpalette.jsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import Appendix from "./pages/Appendix.jsx";
import LiveUpload from "./pages/LiveUpload.jsx";

function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-32 text-center">
      <div className="num text-6xl font-semibold text-brass mb-4">404</div>
      <h1 className="font-display text-2xl font-semibold mb-3">
        This page settled somewhere else.
      </h1>
      <p className="text-ink-muted mb-8">
        There's no route here. Head back to the dashboard or ask the ledger directly.
      </p>
      <a href="/" className="inline-block px-5 py-3 rounded-full bg-brass text-bg font-medium text-sm hover:bg-brass-soft transition-colors">Back to home</a>
    </div>
  );
}

const PAGE_TITLES = {
  "/": "Settl.ai — Reconciliation, grounded",
  "/dashboard": "Settl.ai — Dashboard",
  "/ask": "Settl.ai — Ask the ledger",
  "/audit": "Settl.ai — Audit trail",
  "/calibration": "Settl.ai — Confidence, checked",
  "/trend": "Settl.ai — Trend across cycles",
  "/appendix": "Settl.ai — How it works",
  "/upload": "Settl.ai — Run it on your own data",
};

function PageFade({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function App() {
  const location = useLocation();
  const isLanding = location.pathname === "/";

  useEffect(() => {
    const base = location.pathname.startsWith("/records/")
      ? "Settl.ai — Record detail"
      : PAGE_TITLES[location.pathname] || "Settl.ai";
    document.title = base;
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <ReactiveBackground />
      <CommandPalette />
      {!isLanding && <NavBar />}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageFade><Landing /></PageFade>} />
          <Route path="/dashboard" element={<PageFade><Dashboard /></PageFade>} />
          <Route path="/records/:orderId" element={<PageFade><RecordDetail /></PageFade>} />
          <Route path="/ask" element={<PageFade><Ask /></PageFade>} />
          <Route path="/audit" element={<PageFade><Audit /></PageFade>} />
          <Route path="/calibration" element={<PageFade><Calibration /></PageFade>} />
          <Route path="/trend" element={<PageFade><Trend /></PageFade>} />
          <Route path="/appendix" element={<PageFade><Appendix /></PageFade>} />
          <Route path="/upload" element={<PageFade><LiveUpload /></PageFade>} />
          <Route path="*" element={<PageFade><NotFound /></PageFade>} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}