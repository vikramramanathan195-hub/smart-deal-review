# Deal Discount Review

An internal tool for reviewing multi-line sales deals, where each line item receives an AI-assisted discount recommendation with a full reasoning breakdown and customer context — while keeping the final decision in the hands of the sales rep or manager.

## What it does

- Build a deal from multiple line items, each with its own product category and value
- Each line item gets an AI-suggested discount, broken down by contributing factor (customer tenure, deal size, competitive pressure, margin guardrails)
- Customer relationship context (lifetime value, renewal rate, discount history with win/loss outcomes) is shown alongside every recommendation, so the suggestion is grounded in real precedent, not a black box
- Role-based views: Sales Reps can accept a recommendation or propose their own discount with a reason; proposals within an auto-approve band apply immediately, proposals outside it lock the line for manager approval. Managers get a read-only summary with deal-level approval, gated to deals above a configurable discount threshold
- A live System Health view tracking request volume, response time, and error rate

## Structure

- `frontend/` — Next.js (App Router) app
  - `app/` — pages (sign-in, deal review, system health)
  - `components/` — UI components
  - `lib/` — shared logic, API client, and utilities
- `backend/` — FastAPI backend (in-memory, JWT-authenticated)

## Stack

Next.js (App Router, React 19 + TypeScript), Tailwind CSS, shadcn/ui, TanStack Query, FastAPI.

## Status

Frontend and backend both implemented and wired together. Deployment in progress.
