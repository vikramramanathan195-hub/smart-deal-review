# Deal Discount Review — Frontend

Next.js (App Router) frontend for the Deal Discount Review tool. Talks to the FastAPI backend in `../backend`.

## Structure

- `app/` — pages: sign-in (`/`), deal review (`/deals`), system health (`/health`)
- `components/app/` — app-specific components (AI recommendation panel, line item card, top nav, account menu)
- `components/ui/` — shadcn/ui primitives
- `lib/` — API client, TanStack Query hooks, session state, shared types/helpers

## Run it

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). Requires the backend running (see `../backend/README.md`); set `NEXT_PUBLIC_API_BASE_URL` in `.env.local` if it's not on the default `http://localhost:8000`.
