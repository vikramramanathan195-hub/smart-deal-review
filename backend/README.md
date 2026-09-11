# Backend

FastAPI backend for Deal Discount Review. In-memory only — no database; state resets on restart.

## Run it

```bash
cd backend
cp .env.example .env   # optional, defaults work for local dev
uv run uvicorn app.main:app --reload --port 8000
```

Then open http://localhost:8000/docs for interactive Swagger UI.

## Auth

No real user database — two seeded mock accounts, matched by email + role in `app/auth.py`:

| email | role |
| --- | --- |
| `rep@dealreview.dev` | `sales_rep` |
| `manager@dealreview.dev` | `manager` |

`POST /api/auth/login` with `{"email": ..., "role": ...}` returns a JWT (`Authorization: Bearer <token>`) for the other endpoints.

## Sample deals

Two seeded deals mirror `frontend/src/lib/deal-data.ts` exactly:

- `northwind` — Northwind Industries — FY27 Expansion, blended discount 12.5%, status `within_range`
- `cerulean` — Cerulean Logistics — Competitive Displacement, blended discount 18.1%, status `needs_approval`

## Structure

- `app/models.py` — Pydantic models (request/response bodies + domain types)
- `app/seed_data.py` — the two sample deals, line items, customers, discount history
- `app/store.py` — in-memory `DataStore`, all state mutation logic
- `app/auth.py` — JWT issuing/verification, role-based dependencies
- `app/routers/` — `auth` and `deals` route handlers
- `app/main.py` — app wiring, CORS, field-level validation error formatting
