# BusNOW Production Hardening

## Required Before Final Push
- Rotate Supabase service-role key and Razorpay test/live secrets.
- Keep service-role keys only in Supabase Edge Function secrets.
- Keep browser apps on anon publishable keys only.
- Set production env:
  - `VITE_ENABLE_DEMO_MODE=false`
  - `VITE_ALLOW_LOCAL_MOCKS=false`
  - `VITE_SHOW_DEMO_LOGIN=false`
  - `VITE_SHOW_DEMO_CREDENTIALS=false`
  - `VITE_ALLOW_SIM_GPS=false`
- Run production SQL migrations through the Supabase SQL editor.
- Confirm RLS is enabled on user, staff, bus, route, trip, location, ticket, review, and payment tables.
- Confirm passengers can only read/update their own tickets/reviews.
- Confirm staff-only tables are blocked from passenger accounts.
- Confirm checker can verify tickets but cannot create arbitrary paid tickets.
- Confirm ticket insert/update payment fields are controlled by Edge Functions.

## Demo Environment Rule
Client demo should use real demo data, not silent production fallback.

Use:
- `VITE_ENABLE_DEMO_MODE=true`
- Razorpay test mode
- demo Supabase rows
- demo staff/passenger accounts

Do not use demo mode in production.

## Observability
Both apps now capture global runtime errors. To forward errors to an external logger, set:

```text
VITE_ERROR_LOG_ENDPOINT=https://your-logger.example.com/busnow-errors
```

If this is empty, errors are still logged in the browser console and never break the app.

## Release Commands
Run inside both app folders:

```bash
npm run check:release
npm run build
npm audit --json
```
