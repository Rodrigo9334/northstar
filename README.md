# NorthStar

NorthStar is a mobile-first personal finance app built with Next.js, TypeScript, Tailwind CSS, and the App Router.

Version `0.1` uses mock data only. Supabase and Plaid folders are included so the app can grow into live account syncing later, but Plaid is not connected yet.

## Features

- Dashboard with total cash, checking, vacation fund, safety floor, goal progress, safe-to-spend, and weekly budget
- Weekly budget starting at `$500` with spent, remaining, and green/yellow/red status
- Vacation fund tracker with `$567` current balance, `$50` weekly transfer, and `$3,000` goal
- Monthly review for January through December
- Clickable category and transaction drill-down
- Purchase advisor that checks whether a purchase keeps checking above the `$20,000` safety floor

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- App Router
- Supabase-ready structure
- Plaid-ready structure

## Project Structure

```txt
src/
  app/
    globals.css
    layout.tsx
    page.tsx
  components/
    dashboard-metric.tsx
    monthly-review.tsx
    progress-bar.tsx
    purchase-advisor.tsx
    status-pill.tsx
  lib/
    finance.ts
    mock-data.ts
    plaid/
      config.ts
      README.md
    supabase/
      client.ts
      README.md
```

## Setup

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Optional Environment Variables

These are not required for v0.1 because the app uses mock data.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
```

## Mock Data

The v0.1 balances live in `src/lib/mock-data.ts`:

- Checking: `$23,641`
- Vacation Fund: `$567`
- Total Cash: `$24,208`
- Cash Goal: `$30,000`
- Weekly Budget: `$500`
- Known first-of-month bills: `$4,735`
