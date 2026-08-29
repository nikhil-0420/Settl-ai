# Settl.ai

Reconciles settlement, bank, and ledger records; flags exceptions with reasons;
answers natural-language questions grounded in the actual transaction data.

Built for the Razorpay AI Buildathon — AI Finance Controller track.

## Structure
- `backend/app/` — data generation, matching engine, FastAPI app
- `backend/data/` — synthetic source data + ground truth
- `frontend/` — React/Vite dashboard

## Status
- [x] Day 1: synthetic data generator (3 sources + seeded mismatches + ground truth)
- [x] Day 2: matching engine
- [x] Day 3: exception classifier + confidence scoring
- [x] Day 4: FastAPI backend
- [x] Day 5: embeddings + retrieval
- [x] Day 6-7: Q&A agent
- [x] Day 8: audit trail + failure case
- [x] Day 9-10: React dashboard
- [ ] Day 11: evaluation writeup
- [ ] Day 12: deploy + pitch video
