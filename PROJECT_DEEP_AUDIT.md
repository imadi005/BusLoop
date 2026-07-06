# BusNOW Deep Audit

Date: 2026-07-06

## Executive Status

Payment integration is working at the basic user-flow level: Razorpay checkout can complete, Supabase Edge Functions verify the payment, and a ticket QR can be generated. The app is not production-ready yet. The largest remaining risks are server-side business validation, inconsistent/stale user journeys, weak staff/admin lifecycle handling, missing automated tests, and UI inconsistency between passenger and staff surfaces.

## Fix Batch 1 Completed

- Added trusted `routes.base_fare` and `payment_orders` migration.
- Added Razorpay order/payment idempotency constraints.
- Moved payment amount, trip, route, and stop validation to Edge Functions.
- Blocked staff accounts from passenger payment verification.
- Added replay-safe ticket creation for repeated payment verification calls.
- Moved staff creation to a protected `staff-create` Edge Function.
- Blocked terminated staff in staff auth flow.
- Hardened staff-related RLS policies in migration 010.
- Fixed passenger review eligibility by carrying `bus_id` through ticket mapping.
- Removed misleading local-only review success fallback.
- Removed stale UPI/QR payment page from passenger navigation.
- Redirected legacy `/qr` route to tickets.
- Blocked offline bus booking.
- Blocked invalid/same/reversed stop pairs before payment.
- Disabled automatic fake GPS fallback outside explicit dev mode.
- Removed duplicate hidden checker result UI.
- Split passenger/staff Supabase auth storage keys.
- Replaced Vite favicon references.
- Removed unused Vite starter files and stale UPI files.
- Both passenger and staff apps build successfully after changes.

## Fix Batch 2 Completed

- Restored passenger bus-QR scan path for "scan bus QR -> open bus -> pay" workflow.
- Added a live Bus101 test case with active trip, fresh GPS ping, and clean route/stops data.
- Fixed staff RLS recursion with a `SECURITY DEFINER` active-staff helper.
- Added security guardrails in migration 013:
  - blocked passenger profile role/email/id mutation,
  - restricted checker ticket updates to verification fields,
  - added review comment length guard,
  - moved route preset management to active staff-role checks.
- Removed stale direct passenger ticket insert helper from user app.
- Added `.gitignore` for local env files, caches, and build artifacts.
- Verified live abuse checks block role escalation, direct ticket insert, and oversized/unauthorized review submission.
- Both passenger and staff apps build successfully after the security guardrail changes.

## Fix Batch 3 Completed

- Started UI consistency pass across passenger and staff apps.
- Reworked staff app design tokens from dark/neon to the same professional light BusNOW system.
- Rebuilt staff role-selection screen with clean role cards, consistent icons, and no decorative background clutter.
- Rebuilt staff login screen to match passenger form rhythm, spacing, and card language.
- Normalized visible BusNOW brand casing in passenger header/login and staff dashboard headers.
- Lightened operator dashboard header so it no longer visually clashes with the staff theme.
- Verified staff role and checker-login screens at mobile width.
- Both passenger and staff apps build successfully after UI changes.

## Still Requires Deployment / Live QA

- `migrations/010_production_hardening.sql` has been applied to live Supabase and verified.
- `migrations/011_fix_staff_rls_recursion.sql`, `012_bus101_live_test_data.sql`, and `013_security_guardrails.sql` have been applied to live Supabase and verified.
- Edge Functions deployed live: `razorpay-create-order`, `razorpay-verify-payment`, and `staff-create`.
- Retest a fresh Razorpay payment after the migration is live.
- Retest active-ticket checker verification with a newly generated ticket.
- Real-device camera QR scan still needs Android/iOS verification.
- Rotate the Supabase access token and any test keys before production handoff.
- Bundle-size warning remains and should be handled with code splitting later.
- Continue UI consistency pass inside deeper operator/driver/checker dashboard sections.

## Verified Working

- Passenger login works with seeded passenger credentials.
- Passenger can view live bus data.
- Passenger center QR entry opens the bus-QR scanner page.
- Manual Bus101 QR/code opens the live Bus101 detail page.
- Passenger can open Razorpay payment flow from bus detail.
- Razorpay signature and captured-payment verification exist in Edge Function.
- Ticket QR generation works after successful payment.
- Passenger tickets page can list generated tickets.
- Staff checker login works.
- Checker role exists in staff app role selector.
- Checker manual ticket lookup works for invalid and used tickets.
- Ticket status update is guarded with `status = active` during mark-used.
- Both user and staff builds complete successfully.
- `npm audit` reports no package vulnerabilities in both apps.

## Critical Findings

### Payment Amount Can Be Client-Controlled

The Edge Functions verify that the paid amount matches the Razorpay order, but the order amount itself comes from the browser. A malicious user could call the create-order function with a lower amount, pay that lower amount, and then generate a ticket unless the server recomputes fare from trusted route/trip data.

Files:
- `supabase/functions/razorpay-create-order/index.ts`
- `supabase/functions/razorpay-verify-payment/index.ts`
- `busnow-user-app/src/services/payment.js`

Fix:
- Server must accept trip/route/from/to, recompute fare from DB, create the Razorpay order server-side for that fare, and bind order metadata to the intended ticket.

### Ticket Data Is Client-Trusted

The ticket verification function accepts `trip_id`, `route_id`, `from_stop_id`, and `to_stop_id` from the browser and inserts them using the service role. It does not validate that the trip is active, route belongs to the bus, stops belong to the route, or from/to ordering is valid.

Fix:
- Add server-side validation before ticket insert.
- Reject inactive trips, invalid stop pairs, same from/to stops, and route mismatches.

### No Payment Idempotency

There is no stored Razorpay `payment_id` or unique constraint. A retry or duplicate verification request can create duplicate tickets for one payment.

Fix:
- Add `payment_orders` or `payments` table.
- Store Razorpay order/payment ids.
- Add unique constraints and idempotent verification.

### Staff Creation Uses Public Client Auth

Operator staff creation calls `auth.signUp` from the browser using the anon key, then inserts a staff row. If staff row insert fails, an orphan auth account remains.

File:
- `busnow-staff-app/src/services/api.js`

Fix:
- Move staff creation to a protected Edge Function using service role.
- Enforce operator/super_admin authorization server-side.
- Roll back or disable auth user if staff-row creation fails.

### Terminated Staff Can Still Authenticate

`is_terminated` exists, but login/profile loading does not block terminated staff. RLS policies also generally check role only, not active employment status.

Files:
- `busnow-staff-app/src/context/StaffAuthContext.jsx`
- `migrations/003_staff_collection_photo.sql`
- `migrations/000_full_schema.sql`

Fix:
- Reject terminated staff in auth context and all staff RLS policies.

## High Findings

### Review Eligibility Is Broken

A passenger with a paid ticket still sees "Book a trip to leave a review". `ReviewsPage` expects `t.trips?.bus_id`, but `ticketService.getMyTickets` does not select or map `trips.bus_id`.

Files:
- `busnow-user-app/src/pages/ReviewsPage.jsx`
- `busnow-user-app/src/services/api.js`

### Review Insert Is Too Permissive

Database policy lets any passenger review any bus. UI tries to restrict by ticket history, but the DB does not enforce it.

Fix:
- Review insert policy should require an existing used/active ticket for that bus or trip.

### Old UPI Payment Flow Still Exposed

The passenger app still has `/qr`, `UPIPayModal`, and bottom-nav QR access. These flows say payment goes directly to the operator and do not match the new Razorpay verified-ticket workflow.

Files:
- `busnow-user-app/src/App.jsx`
- `busnow-user-app/src/components/BottomNav.jsx`
- `busnow-user-app/src/pages/QRPage.jsx`
- `busnow-user-app/src/components/UPIPayModal.jsx`

### Checker Result UI Has Duplicate State

After invalid/used lookup, the DOM contains duplicate "Scan Next" controls, suggesting both legacy inline result UI and modal/result UI are active.

File:
- `busnow-staff-app/src/pages/checker/CheckerDashboard.jsx`

### QR Camera Scanner Is Browser-Limited

Staff scanner relies on `BarcodeDetector`, which is not consistently supported across Safari/iOS and many WebViews.

File:
- `busnow-staff-app/src/components/CameraQRScanner.jsx`

Fix:
- Use `jsQR` fallback or a Capacitor/native scanner plugin.

### Fake GPS Can Reach Production

Driver app falls back to simulated Bangalore movement when GPS fails. This can create fake live tracking in production.

File:
- `busnow-staff-app/src/pages/driver/DriverDashboard.jsx`

Fix:
- Disable simulation outside demo/dev mode.
- Show GPS failure and prevent live trip tracking until real GPS is available.

## Medium Findings

### UI Feels Like Multiple Products

Passenger app is light/red/mobile-first. Staff app is dark/neon/emoji-heavy. Typography, spacing, icon style, cards, and tone are inconsistent.

Fix:
- Create one BusNOW design system shared across both apps.
- Define brand casing, colors, button styles, header patterns, modal behavior, and empty states.

### Brand Casing Is Inconsistent

The app uses `BusNow`, `BusNOW`, and stale `BusLoop Live`.

Files:
- `busnow-user-app/src/pages/HomePage.jsx`
- `busnow-user-app/src/components/AppHeader.jsx`
- `busnow-staff-app/src/pages/*`

### Favicon Still Uses Vite

Both apps still reference `/vite.svg`.

Files:
- `busnow-user-app/index.html`
- `busnow-staff-app/index.html`

### Vite Starter Files Remain

Unused starter files remain in both apps: `src/main.ts`, `src/counter.ts`, `src/style.css`, and starter assets. Actual app entry uses `main.jsx`.

### Mojibake / Encoding Artifacts

Source contains many corrupted characters such as `â€”`, `âœ“`, `ðŸ...`. Some render okay, but source quality is poor and text may break across environments.

### CDN Runtime Dependencies

Ticket QR rendering loads `qrcode-generator` from CDN in multiple places. This can fail offline and complicates Content Security Policy.

Files:
- `busnow-user-app/src/pages/TicketsPage.jsx`
- `busnow-user-app/src/components/TicketSuccessModal.jsx`
- `busnow-user-app/src/components/UPIPayModal.jsx`

### Stale "Pay On Bus" Copy

Bus detail still shows fare subtitle as "Pay on bus" even though the primary flow is Razorpay.

File:
- `busnow-user-app/src/pages/BusDetailPage.jsx`

### Live Location Subscription Warning

Bus detail logs a Supabase realtime subscription warning after page load. Live data still displays, but subscription lifecycle needs cleanup.

File:
- `busnow-user-app/src/pages/BusDetailPage.jsx`

### Route/Stop Data Quality Issue

Paid tickets and payment modal showed `from = asd`, `to = asd`, making the successful workflow look unprofessional and logically invalid.

Fix:
- Validate route/stops at operator input time.
- Prevent same/placeholder stop names in booking.

## Database / RLS Concerns

- `operator_settings` allows any authenticated user to update payment settings.
- App code uses `app_settings`, while migrations create `operator_settings`.
- `locations` are readable by everyone, including historical precise location data.
- Drivers can update bus status broadly, not clearly only assigned/current bus.
- Trip policies do not consistently include `WITH CHECK`.
- Migration history has conflicting role models: old scripts use `public.users` for staff roles, newer code uses `public.staff`.
- `route_presets` policy name says operators, but includes drivers.
- Ticket direct insert is hardened by migration 009, but there is no automated assertion test for it.

## Testing Gaps

- No web unit tests.
- No web e2e tests.
- No payment idempotency tests.
- No RLS regression tests.
- No role-access matrix tests.
- No checker QR scan device test.
- No mobile viewport screenshot regression tests.
- No route/fare validation tests.
- No terminated staff access test.
- No review eligibility test.

## Manual Test Matrix Needed

Passenger:
- Signup new passenger.
- Login/logout.
- Staff-account blocked from passenger app.
- Live bus list.
- Bus detail with active trip.
- Bus detail with inactive trip.
- Book ticket with valid stops.
- Reject same stop.
- Payment cancel.
- Payment failure.
- Payment success.
- Ticket appears immediately.
- QR opens and downloads.
- Used ticket state.
- Review after ticket.

Checker:
- Login checker.
- Invalid code.
- Used code.
- Active code lookup.
- Mark active ticket used.
- Scan next reset.
- Camera permission denied.
- Camera unavailable.
- Real QR scan on Android/iOS.

Driver:
- Login driver.
- Start trip.
- GPS permission granted.
- GPS permission denied.
- End trip.
- Prevent logout during active trip.
- Background/lock-screen behavior.

Operator:
- Login operator.
- Add bus.
- Add driver/checker.
- Terminate/reinstate staff.
- Assign routes.
- Create route/stops.
- Analytics values.
- Live map values.

Security:
- Passenger direct ticket insert blocked.
- Staff cannot create passenger tickets.
- Staff cannot use passenger app.
- Passenger cannot access staff app.
- Terminated staff cannot access staff app.
- Unauthorized user cannot create Razorpay order.
- Replayed payment verification cannot create duplicate ticket.
- Low-amount tampering rejected.
- Invalid trip/stop tampering rejected.

## Recommended Fix Order

1. Harden payment/ticket server validation and idempotency.
2. Add RLS regression tests and fix staff/terminated-role policies.
3. Remove stale UPI/manual payment flows or clearly move them to an admin-only legacy path.
4. Fix review eligibility and DB policy.
5. Fix checker duplicate result state and add robust QR scanner fallback.
6. Disable mock/demo fallbacks in production.
7. Normalize UI/design system across passenger and staff apps.
8. Clean starter files, favicon, brand casing, encoding artifacts.
9. Add Playwright e2e suite for passenger payment and staff checker flows.
10. Add mobile viewport/device QA for ticket modals and camera flows.
