// Settl.ai API client — wraps every backend endpoint from main.py.
// Base URL comes from VITE_API_URL (set in .env for local dev / Render deploy),
// falling back to the local FastAPI default so `npm run dev` works out of the box.
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const exportUrl = (type) => `${BASE_URL}/export/${type}`;

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const CONFIDENCE_EXPLANATIONS = {
  clean_match: "Based on how close the bank credit is to the settlement's net amount — the closer to exact, the higher the score.",
  partial_payment: "Based on how far the shortfall exceeds the ₹50 tolerance — further past tolerance means higher confidence it's a real partial payment.",
  fee_deduction_err: "Based on how far the fee + tax total deviates from the expected 2% + GST calculation.",
  tds_gst_mismatch: "Based on how far the TDS deducted deviates from the expected 1% (Sec 194-O) calculation.",
  timing_gap: "Based on how close the bank credit's date is to the edge of the matching window — gaps near T+2 score higher, gaps near the outer edge score lower.",
  duplicate: "Structurally obvious — flagged whenever the same order_id appears more than once. Not a graduated judgment.",
  unmatched: "Fired because no other classification explained this record.",
  phantom_bank: "No corresponding settlement record exists — always flagged for manual review regardless of magnitude.",
  phantom_ledger: "No corresponding ledger invoice exists — always flagged for manual review regardless of magnitude.",
};

export const api = {
  matchSummary: () => request("/match-summary"),
  records: (status) => request(`/records${status ? `?status=${status}` : ""}`),
  recordDetail: (orderId) => request(`/records/${orderId}`),
  ask: (question, simulateOutage = false, history = []) =>
    request(`/ask${simulateOutage ? "?simulate_outage=true" : ""}`, {
      method: "POST",
      body: JSON.stringify({ question, history }),
    }),
  auditLog: (limit = 50) => request(`/audit-log?limit=${limit}`),
  trend: () => request("/trend"),
  resolveRecord: (orderId, note) =>
    request(`/records/${orderId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
};
