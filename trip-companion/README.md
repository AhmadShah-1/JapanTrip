# Trip Companion

A public, no-auth Next.js trip dashboard for the Japan + Korea itinerary imported from the `Information/` notes.

## Features

- Shared CRUD for activities, expenses, bookings, guides, and checklist items
- Automatic seed import from the copied trip notes and itinerary HTML
- Dashboard, calendar, expenses, budget, bookings, guidance, and checklist tabs
- USD-first money display with local-currency hover details
- Neon/Vercel-ready persistence with a seed-only fallback when `DATABASE_URL` is missing

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Add environment variables:

```bash
cp .env.example .env.local
```

Set `DATABASE_URL` to the Neon/Vercel connection string for the `japantrip` database.

3. Run the app:

```bash
npm run dev
```

4. Optional: reset the database back to the imported seed data by calling:

```bash
POST /api/init
```

## Deployment Notes

- Deploy the `trip-companion` folder to Vercel.
- Add `DATABASE_URL` in the Vercel project environment variables.
- The app seeds itself on first database use.
- If `DATABASE_URL` is omitted, the UI still renders the trip in read-only seed mode.

## Verification

The app currently passes:

```bash
npm run lint
npm run build
```
