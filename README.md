# DealFlow AI

Build a professional internal enterprise web app called "Deal Discount Review" — a tool where sales reps build multi-line deals, receive AI-suggested discounts per line, and see whether the overall deal falls within policy.

IMPORTANT: Use Next.js (App Router) with TypeScript and Tailwind CSS. Use shadcn/ui components. Do not use plain React + Vite.

## Design quality bar

This must look like professional enterprise software — think Linear, Stripe's dashboard, or Vercel's dashboard. Clean, considered, and polished. Light background (#F7F8FA), white cards with subtle layered shadows and 12px rounded corners, deep navy (#1E2761) as primary, indigo (#6461E0) as the AI accent color, Inter font with a clear typographic scale. Consistent 8px-based spacing. Subtle hover states on every interactive element. This is an internal tool, but "internal" should not mean unpolished.

## Three pages

### Page 1 — Login (/)

Centered card (440px wide) on a light background, with a soft shadow and rounded corners. Contains: a small circular navy logo mark with the letter "D", the title "Deal Discount Review", a subtitle "Sign in to review and approve deals", an email input, a Role dropdown (options: "Sales Rep", "Manager"), and a full-width navy "Sign In" button. Selecting a role determines which view the user gets after signing in — store this in state/context.

### Page 2 — Deal Review (/deals)

Top nav bar (white, subtle bottom border): navy circular logo with "D", app title, and on the right a pill showing the current role ("Sales Rep" or "Manager").

**Deal header card** with three fields: Deal Name (text), Term Length (segmented control: 12mo / 24mo / 36mo), Product Categories (multi-select dropdown with options: Compute, Storage, Networking, Services).

**Line Items section** — a dynamic list of line item cards. Seed the app with 3 line items so the multi-line behavior is immediately visible. Each line item card contains:

- Product Category (dropdown), Deal Value (currency input), and an ✕ button to remove that line

- Below those, a large AI Discount Recommendation panel (indigo-tinted background, indigo left accent bar 4px wide, rounded corners) containing a header row with a small indigo circular icon and the title "AI Discount Recommendation", then THREE columns side by side:

  **Column 1 — Recommendation (white card):** label "RECOMMENDED DISCOUNT" in small uppercase letter-spaced muted text, a very large percentage figure (e.g. 12%), a line showing the net dollar value ("Net: $158,400 on $180,000"), a color-coded confidence badge (green = high, amber = medium, red = low) with a small dot and text. Below a divider: label "YOUR DECISION", a full-width navy primary button "Accept 12%", and two outlined secondary buttons side by side: "Adjust" and "Override".

  **Column 2 — Why this number (white card):** heading "Why this number", subtitle "Each factor below adjusts the baseline discount." Then a list of 5 contributing factors, each with: factor name on the left, its percentage contribution on the right (green for positive, red for negative), and a thin proportional progress bar beneath showing relative weight. Factors: "Baseline (segment: Enterprise)" 8.0%, "Customer tenure (4 yrs)" +2.5%, "Deal size tier" +2.0%, "Regional competitive pressure" +1.5%, "Margin floor guardrail" −2.0% (red). Below a divider: "Final recommendation" with the total percentage in bold.

  **Column 3 — Customer context (white card):** heading "Customer context", subtitle: "Northwind Industries · Partner since 2022". Then three small stat boxes in a row: Lifetime value ($1.24M), Renewal rate (100%), Avg discount (10.7%). Below that, a "Discount history" section: 4 rows, each showing a date, a horizontal bar representing the discount level (green if the deal was Won, red if Lost), the percentage, and the outcome label "Won" or "Lost" in matching color. At the bottom, an amber-tinted callout box with a "!" icon reading: "1.3 pts above their historical average — still within policy."

- A dashed-border "+ Add Line Item" button below the line items list, which adds a new empty line item.

**Deal Summary card** at the bottom: "Total Deal Value" (sum of all line values), "Blended Discount" (weighted average across lines), a large pill-shaped color-coded status badge on the right ("Within Range" green / "Needs Review" amber / "Exceeds Policy" red) based on the blended discount against thresholds, and a plain-language note explaining the status.

### Page 3 — System Health (/health)

Top nav with a small green pulsing dot and "Live" label on the right. Four stat cards in a row: Concurrent Users, Avg Response Time, Error Rate, Uptime (30d) — each with a label, a large bold value, and a small green trend delta below. Then a large chart card titled "Request Volume — Last Hour" with a filled area line chart (indigo line, light indigo fill beneath), subtle horizontal gridlines, and axis labels.

## Role-based behavior

- **Sales Rep**: full editing of line items, sees the AI panel with Accept/Adjust/Override controls

- **Manager**: line items are read-only (no editing, no Accept/Adjust/Override buttons), but sees the same reasoning columns. Instead, a deal-level "Approve Deal" / "Request Changes" action appears in the Deal Summary card, and it only becomes active when the blended discount exceeds 15%.

## Required states — design these properly, not as defaults

- Empty state when there are zero line items ("No line items yet — add one to get started")

- Skeleton loading state while an AI recommendation is "generating" (simulate a brief 800ms delay when a new line item is added, showing a skeleton in the AI panel before the recommendation appears)

- Inline field-level validation with specific messages (e.g. "Deal value must be greater than 0", "Discount cannot exceed 100%") shown directly beneath the relevant field, never as a generic form-level error

- A confirmation modal before removing a line item

All data should be mocked/hardcoded in the frontend for now — no backend needed yet. Use realistic, varied sample data across the three seeded line items (different categories, values, and discount recommendations), not repeated placeholder data.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6779c48d-4d5d-41a4-9e05-77a44621c59d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
