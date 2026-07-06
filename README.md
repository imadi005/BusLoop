# BusLoop

BusLoop is a real-time bus ticketing and tracking system with two web apps:

- Passenger app for booking tickets, paying online, viewing QR tickets, rating trips, and scanning bus QR codes.
- Staff app for operators, drivers, and checkers to manage buses, start live trips, share GPS, show bus QR, and verify passenger tickets.

## Live Demo

| App | URL |
| --- | --- |
| Passenger App | https://busloop-user-app.vercel.app |
| Staff App | https://busloop-staff-app.vercel.app |

## Tested Demo Login Credentials

### Passenger

| Role | Email | Password |
| --- | --- | --- |
| Passenger | `passenger@busnow.app` | `Passenger@123` |

### Staff

All staff users log in from the Staff App.

| Role | Email | Password |
| --- | --- | --- |
| Operator | `operator1@busnow.app` | `Staff@BusNow2026` |
| Driver | `driver1@busnow.app` | `Staff@BusNow2026` |
| Checker | `checker1@busnow.app` | `Staff@BusNow2026` |

## Razorpay Test Payment Details

Use these details only in Razorpay test mode.

| Field | Value |
| --- | --- |
| Card Number | `5267 3181 8797 5449` |
| Expiry | Any future date, for example `12/30` |
| CVV | Any 3 digits, for example `123` |
| Name | Any name |
| OTP | `123456` |

## Main Tested Flows

### Passenger Flow

1. Open the Passenger App.
2. Log in using the passenger credentials.
3. Select a live bus or scan a bus QR code.
4. Book a ticket.
5. Complete Razorpay test payment.
6. Confirm that a QR ticket is generated.
7. View active, used, and expired tickets from the Tickets page.
8. Rate completed trips from the Tickets or Reviews page.

### Checker Flow

1. Open the Staff App.
2. Select Checker.
3. Log in using the checker credentials.
4. Scan a passenger ticket QR code or enter the ticket code manually.
5. Verify valid tickets.
6. Confirm used tickets show boarding time.
7. Use the bus QR button to show passengers the QR for buying tickets.

### Driver Flow

1. Open the Staff App.
2. Select Driver.
3. Log in using the driver credentials.
4. Select an assigned bus.
5. Start a trip.
6. Allow location permission on mobile.
7. Confirm live GPS updates are sent.
8. End the trip when complete.

### Operator Flow

1. Open the Staff App.
2. Select Operator.
3. Log in using the operator credentials.
4. View analytics, collection totals, buses, routes, staff, and settings.
5. Add or manage buses and routes.
6. Open bus QR codes for passenger booking.
7. View live bus location on the map when a driver is sharing GPS.

## Ticket Rules

- A paid ticket is valid for boarding within 2 hours of booking.
- The ticket becomes used after checker verification.
- Expired tickets appear separately from active tickets.
- Cancellation and refund are not allowed for demo flow.

## Local Development

### Passenger App

```powershell
cd busnow-user-app
npm install
npm run dev
```

Default local URL: `http://localhost:5173`

### Staff App

```powershell
cd busnow-staff-app
npm install
npm run dev
```

Default local URL: `http://localhost:5174`

## Environment Variables

Create `.env` files from the examples before running locally.

### Passenger App

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_RAZORPAY_KEY_ID=
VITE_ENABLE_DEMO_MODE=false
VITE_SHOW_DEMO_LOGIN=false
VITE_DEMO_PASSENGER_EMAIL=
VITE_DEMO_PASSENGER_PASSWORD=
VITE_ALLOW_LOCAL_MOCKS=false
VITE_ERROR_LOG_ENDPOINT=
```

### Staff App

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ENABLE_DEMO_MODE=false
VITE_SHOW_DEMO_CREDENTIALS=false
VITE_DEMO_STAFF_PASSWORD=
VITE_ALLOW_LOCAL_MOCKS=false
VITE_ALLOW_SIM_GPS=false
VITE_ERROR_LOG_ENDPOINT=
```

## Production Notes

- Keep Supabase service-role keys only in Supabase Edge Function secrets.
- Keep Razorpay secret keys only in Supabase Edge Function secrets.
- Do not commit `.env`, `.vercel`, build folders, or local Supabase temp files.
- For mobile camera scanning, use HTTPS or a supported secure local setup.

## Current Hosted Status

- Passenger app is deployed and publicly reachable.
- Staff app is deployed and publicly reachable.
- BusLoop logo and favicon assets are applied to both apps.
- Old BusNOW public URLs have been removed from active public routing.
