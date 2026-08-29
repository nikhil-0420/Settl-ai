import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { motion, AnimatePresence } from "framer-motion";

const SAMPLE_QUESTIONS = [
  "Why didn't order_200036U reconcile cleanly?",
  "Which orders have TDS mismatches?",
  "What was Settl.ai's revenue last quarter?",
];

export default function Ask() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [simulateOutage, setSimulateOutage] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % SAMPLE_QUESTIONS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history, loading]);

  const submit = async (q) => {
    const finalQuestion = q ?? question;
    if (!finalQuestion.trim() || loading) return;
    setLoading(true);
    setQuestion("");

    const lastSuccessful = [...history].reverse().find((turn) => turn.result && !turn.error);
    const conversationHistory = lastSuccessful
      ? [{ question: lastSuccessful.question, answer: lastSuccessful.result.answer }]
      : [];

    try {
      const result = await api.ask(finalQuestion, simulateOutage, conversationHistory);
      setHistory((prev) => [...prev, { question: finalQuestion, result, error: null }]);
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        { question: finalQuestion, result: null, error: err.message },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => setHistory([]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col" style={{ minHeight: "calc(100vh - 64px)" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Ask the ledger</h1>
          <p className="text-ink-muted mt-1">
            Every answer cites a real order ID it retrieved. If the data doesn't
            support a confident answer, it says so — it doesn't guess.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSimulateOutage((v) => !v)}
            title="Simulate LLM outage — kills the model call and shows the escalation fallback"
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${simulateOutage
              ? "border-settle-critical text-settle-critical bg-settle-critical/10"
              : "border-rule text-ink-faint hover:border-ink-muted hover:text-ink-muted"
              }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${simulateOutage ? "bg-settle-critical" : "bg-ink-faint"}`} />
            Outage sim
          </button>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs px-3 py-1.5 rounded-full border border-rule text-ink-muted hover:border-settle-critical hover:text-settle-critical transition-colors whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Conversation */}
      <div className="mt-8 flex-1 space-y-5">
        {history.length === 0 && !loading && (
          <div className="flex flex-wrap gap-2 pt-2">
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => submit(q)}
                className="text-xs px-3 py-1.5 rounded-full border border-rule text-ink-muted hover:border-brass hover:text-brass transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {history.map((turn, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl bg-panel-raised border border-rule-soft px-4 py-2.5 text-sm text-ink-primary">
                {turn.question}
              </div>
            </div>
            <div className="flex justify-start">
              {turn.error ? (
                <div className="max-w-[85%] rounded-2xl border border-settle-critical/40 text-settle-critical text-sm px-4 py-3">
                  {turn.error}
                </div>
              ) : (
                <AnswerCard result={turn.result} />
              )}
            </div>
          </motion.div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-rule-soft px-4 py-3 flex gap-1.5 items-center">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full bg-brass/60"
                  style={{ animation: "typingDot 1.2s ease-in-out infinite", animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-3 mt-6 sticky bottom-6"
      >
        <div className="relative flex-1">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full bg-panel border border-rule rounded-full px-5 py-3 text-sm text-ink-primary focus:border-brass focus:ring-2 focus:ring-brass/20 outline-none transition-shadow"
          />
          {!question && (
            <div className="absolute inset-0 flex items-center px-5 pointer-events-none overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.span
                  key={placeholderIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="text-sm text-ink-faint"
                >
                  {SAMPLE_QUESTIONS[placeholderIndex]}
                </motion.span>
              </AnimatePresence>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-3 rounded-full bg-brass text-bg font-medium text-sm hover:bg-brass-soft transition-colors disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}

function AnswerCard({ result }) {
  const isRefusal = result.is_refusal;
  return (
    <div
      className={`max-w-[85%] rounded-2xl border px-4 py-3.5 ${isRefusal ? "border-ink-faint/30" : "border-brass/30"}`}
    >
      <p className={`text-sm leading-relaxed ${isRefusal ? "text-ink-muted italic flex gap-2" : "text-ink-primary"}`}>
        {isRefusal && <span className="not-italic text-ink-faint shrink-0">—</span>}
        {result.answer}
      </p>
      {!isRefusal && result.cited_ids?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-rule-soft">
          {result.cited_ids.map((id) => (
            <Link
              key={id}
              to={`/records/${id}`}
              className="num text-xs px-2.5 py-1 rounded-full border border-brass/40 text-brass hover:bg-brass/10 hover:scale-105 transition-all"
            >
              {id} →
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}