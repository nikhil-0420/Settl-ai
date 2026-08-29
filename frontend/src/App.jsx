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
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

const PAGE_TITLES = {
  "/": "Settl.ai — Reconciliation, grounded",
  "/dashboard": "Settl.ai — Dashboard",
  "/ask": "Settl.ai — Ask the ledger",
  "/audit": "Settl.ai — Audit trail",
  "/calibration": "Settl.ai — Confidence, checked",
  "/trend": "Settl.ai — Trend across cycles",
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
        </Routes>
      </AnimatePresence>
    </div>
  );
}
