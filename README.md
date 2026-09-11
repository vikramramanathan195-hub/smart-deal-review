# Deal Discount Review

An internal tool for reviewing multi-line sales deals, where each line item receives an AI-assisted discount recommendation with a full reasoning breakdown and customer context — while keeping the final decision in the hands of the sales rep or manager.

## What it does

- Build a deal from multiple line items, each with its own product category and value
- Each line item gets an AI-suggested discount, broken down by contributing factor (customer tenure, deal size, competitive pressure, margin guardrails)
- Customer relationship context (lifetime value, renewal rate, discount history with win/loss outcomes) is shown alongside every recommendation, so the suggestion is grounded in real precedent, not a black box
- Role-based views: Sales Reps can accept, adjust, or override any recommendation; Managers get a read-only summary with deal-level approval, gated to deals above a configurable discount threshold
- A live System Health view tracking request volume, response time, and error rate

## Structure

- `frontend/` — TanStack Start app
  - `src/routes/` — application pages (sign-in, deal review, system health)
  - `src/components/` — UI components
  - `src/hooks/`, `src/lib/` — shared logic and utilities
- `backend/` — FastAPI backend (not yet implemented)

## Stack

TanStack Start (React 19 + TypeScript), Tailwind CSS, shadcn/ui, TanStack Router, TanStack Query.

## Status

Frontend complete with mocked data. Backend (FastAPI) and deployment in progress.
