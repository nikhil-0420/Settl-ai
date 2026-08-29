import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import LedgerSweep from "../components/LedgerSweep.jsx";
import Footer from "../components/Footer.jsx";
import { api } from "../lib/api.js";
import useCountUp from "../lib/useCountUp.js";
import { motion } from "framer-motion";
import { TextGenerateEffect } from "../components/TextGenerateEffect.jsx";
import DynamicText from "../components/DynamicText.jsx";
import { SettlMark } from "../components/SettlMark.jsx";

function EyebrowRule({ children }) {
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-ink-faint">
      <span className="h-px w-8 bg-rule" />
      {children}
    </div>
  );
}

export default function Landing() {
  const [summary, setSummary] = useState(null);
  const animatedMatchRate = useCountUp(summary ? summary.match_rate * 100 : null, { decimals: 1 });
  const animatedTotal = useCountUp(summary?.total_records ?? null);

  useEffect(() => {
    api.matchSummary().then(setSummary).catch(() => { });
  }, []);

  return (
    <div>
      {/* Nav — minimal on landing, full nav starts on app pages */}
      <header className="max-w-6xl mx-auto px-6 h-28 flex items-center justify-between">
        <span className="flex items-center gap-4 font-display font-semibold text-3xl md:text-4xl tracking-tight">
          <SettlMark size={44} />
          Settl<span className="text-brass">.ai</span>
        </span>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/nikhil-0420/settl-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-md border border-rule text-ink-muted hover:text-brass hover:border-brass transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
              <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.71 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.44-2.7 5.42-5.27 5.7.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .3.2.66.79.55A10.52 10.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
            </svg>
            View on GitHub
          </a>
          <Link
            to="/dashboard"
            className="text-sm px-4 py-2 rounded-md border border-rule text-ink-muted hover:text-brass hover:border-brass transition-colors"
          >
            Open dashboard →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 grid md:grid-cols-2 gap-16 items-start">
        <div>
          <EyebrowRule>AI Finance Controller · Razorpay Buildathon</EyebrowRule>
          <h1 className="font-display text-5xl md:text-6xl font-semibold leading-[1.05] mt-6 tracking-tight">
            It settles the
            <br />
            reconciliation.
            <br />
            <span className="text-brass relative inline-block">
              And the question.
              <span
                className="absolute left-0 -bottom-1 h-[2px] bg-brass origin-left animate-[draw_0.8s_ease-out_forwards]"
                style={{ width: "100%", transform: "scaleX(0)" }}
              />
            </span>
          </h1>
          <TextGenerateEffect
            words="Settl.ai reconciles settlement, bank, and ledger records automatically, flags every exception with a reason, and answers finance questions grounded in the real transaction data — refusing to guess when it isn't sure."
            className="text-ink-muted text-lg mt-6 max-w-md leading-relaxed"
          />
          <div className="flex items-center gap-4 mt-8">
            <Link
              to="/dashboard"
              className="px-5 py-3 rounded-full bg-brass text-bg font-medium text-sm hover:bg-brass-soft transition-colors"
            >
              View live reconciliation
            </Link>
            <Link
              to="/ask"
              className="px-5 py-3 rounded-full border border-rule text-sm text-ink-primary hover:border-brass transition-colors"
            >
              Ask the ledger
            </Link>
          </div>

          <DynamicText className="mt-6 text-sm" />

          {summary && (
            <div className="flex items-center gap-8 mt-12 pt-6 border-t border-rule-soft">
              <div>
                <div className="num text-2xl font-semibold text-brass">
                  {animatedMatchRate}%
                </div>
                <div className="text-xs text-ink-faint mt-1">match rate</div>
              </div>
              <div>
                <div className="num text-2xl font-semibold text-ink-primary">
                  {animatedTotal}
                </div>
                <div className="text-xs text-ink-faint mt-1">records reconciled</div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center mt-24">
          <LedgerSweep />
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-24 border-t border-rule">
        <EyebrowRule>How it settles</EyebrowRule>
        <p className="text-ink-faint text-sm mt-3 max-w-md">
          Six steps, in order — from first match to long-term trend.
        </p>
        <div className="mt-12 space-y-14">
          {[
            [
              { title: "Match, deterministically", body: "Exact UTR match, then amount-tolerance fuzzy pass, then a date-window pass — every classification traces to a rule, not a guess.", to: "/dashboard" },
              { title: "Flag, with a reason", body: "Every exception carries a confidence score reflecting how far it sits from the tolerance boundary — verified to track real seeded deviation, not just asserted.", to: "/calibration" },
              { title: "Answer, with a citation", body: "The Q&A agent grounds every claim in a real order ID it retrieved — and says so plainly when the data doesn't support an answer.", to: "/ask" },
            ],
            [
              { title: "Resolve, with a note", body: "A reviewer can mark any exception resolved with a note, kept separate from the matcher's own classification — human judgment and machine output stay independently auditable.", to: "/dashboard" },
              { title: "Export the report", body: "The full reconciliation report — headline stats, breakdown, exceptions, resolution status — as CSV or PDF, one click from the dashboard.", to: "/dashboard" },
              { title: "Watch it over time", body: "Match rate and exception mix across settlement cycles, not just a single snapshot — including how an anomaly like a TDS rate change would surface and taper.", to: "/trend" },
            ],
          ].map((row, rowIndex) => (
            <div key={rowIndex} className="grid md:grid-cols-3 gap-6">
              {row.map((item, i) => {
                const stepNumber = rowIndex * 3 + i + 1;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 0.4, delay: i * 0.12, ease: "easeOut" }}
                  >
                    <Link to={item.to} className="relative overflow-hidden panel p-6 hover:border-brass/40 hover:-translate-y-0.5 transition-all group block h-full">
                      <span
                        className="absolute top-2 right-4 text-3xl font-display font-normal italic text-ink-primary/[0.09] group-hover:text-brass/15 transition-colors select-none pointer-events-none leading-none"
                        aria-hidden="true"
                      >
                        {String(stepNumber).padStart(2, "0")}
                      </span>
                      <h3 className="relative font-display font-semibold text-lg mb-2 group-hover:text-brass transition-colors">
                        {item.title}
                      </h3>
                      <p className="relative text-sm text-ink-muted leading-relaxed">{item.body}</p>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}