# BusNOW Client E2E Test Report

**Date:** 06 July 2026  
**Environment:** Hosted Vercel production demo apps  
**User App:** https://busnow-user-app.vercel.app  
**Staff App:** https://busnow-staff-app.vercel.app  
**Backend:** Supabase live project  
**Payments:** Razorpay Test Mode

## Executive Summary

BusNOW was tested end-to-end across passenger booking, Razorpay payment, ticket generation, checker verification, operator workflows, staff creation, route creation, and driver live-trip visibility.

The core passenger payment and ticket verification flow is working. Razorpay payment completes successfully, a ticket is generated with QR details, checker verification marks the ticket as boarded, and duplicate ticket use is blocked correctly.

The previously observed operator Add Bus issue has been fixed, redeployed, and retested successfully on the hosted production staff app.

Driver GPS live-location was rechecked on a real phone and confirmed working by the project owner. The earlier desktop browser result was treated as an environment/permission limitation, not an application failure.

## Test Accounts

Credentials were supplied separately for these roles:

- Passenger: passenger@busnow.app
- Checker: checker1@busnow.app
- Driver: driver1@busnow.app
- Operator: operator1@busnow.app

## Test Data Created

| Item | Value | Result |
| --- | --- | --- |
| E2E Route | E2E Origin 050151 to E2E Destination 050151 | Created successfully |
| E2E Staff | E2E Driver 050151 | Created successfully |
| E2E Bus | E2E Fixed Bus 039156 | Created successfully after redeploy |
| Verified Ticket | 045163e5-2343-487b-a6ef-02915a59ce97 | Payment, generation, scan, and duplicate-block tested |

## E2E Checklist

| Area | Test Case | Expected Result | Actual Result | Status |
| --- | --- | --- | --- | --- |
| Passenger | Login as passenger | Passenger lands in user app | Login worked | Pass |
| Passenger | View live bus/route booking entry | User can start ticket booking | Booking entry available | Pass |
| Passenger | Razorpay test payment | Payment completes in test mode | Payment completed successfully | Pass |
| Passenger | Ticket generation after payment | Ticket modal appears with ticket details and QR | Ticket generated successfully | Pass |
| Passenger | Ticket validity | Ticket shows 2-hour boarding validity | Validity and expiry information present | Pass |
| Passenger | Ticket list | New ticket appears in user tickets section | Ticket visible after booking | Pass |
| Passenger | Review UX | Completed/used tickets can be rated | Review UX available for used journeys | Pass |
| Checker | Login as checker | Checker dashboard opens | Login worked | Pass |
| Checker | Manual ticket lookup | Ticket code can be checked manually | Valid ticket details loaded | Pass |
| Checker | Mark ticket verified | Active ticket becomes used/boarded | Ticket marked verified | Pass |
| Checker | Duplicate scan prevention | Used ticket cannot be verified again | Duplicate use blocked | Pass |
| Checker | Bus purchase QR | Checker can show bus QR for passengers without ticket | QR option available on checker flow | Pass |
| Operator | Login as operator | Operator dashboard opens | Login worked | Pass |
| Operator | Analytics overview | Dashboard KPIs render consistently | KPIs visible | Pass |
| Operator | Create route | New route saves and appears in routes list | Route created and visible | Pass |
| Operator | Create staff | New driver/checker account can be created | E2E driver created and visible | Pass |
| Operator | Add bus | New bus should save and appear in fleet | Bus created, fleet count increased, and QR modal opened | Pass |
| Operator | Live bus map button | Live button should open map for active buses | Available for active bus only | Pass |
| Operator | Disabled live state | Non-live buses should not open live map | Disabled state shown for inactive buses | Pass |
| Driver | Login as driver | Driver dashboard opens | Login worked | Pass |
| Driver | Active trip visibility | Driver sees active trip details | Active trip displayed | Pass |
| Driver | GPS permission flow | Location permission should start GPS pings | Working on real phone test | Pass |
| Driver | End trip safety | End trip should not be triggered accidentally | Not executed during E2E to avoid changing demo state | Not Run |

## Payment Flow Evidence

Razorpay Test Mode payment was completed using supported domestic test card details. After payment success, BusNOW generated a paid ticket and displayed the QR ticket modal. The ticket was then verified from the checker side and correctly transitioned to a used/boarded state.

## Verification Flow Evidence

The checker flow accepted a valid ticket code, loaded route and passenger details, and allowed marking the ticket as verified. A repeated check of the same ticket was rejected as expected, confirming duplicate-use prevention.

## Operator Mutation Evidence

Route creation was tested through the hosted operator UI and passed. The route count increased and the new E2E route was visible in the route list.

Staff creation was tested through the hosted operator UI and passed. The staff count increased from 4 to 5, and the new E2E driver appeared in the staff list.

Add Bus initially failed on the hosted operator UI because the live database schema could reject optional bus fields. The save layer was updated to retry with the core bus payload when optional schema fields are unavailable. After redeploy, Add Bus was retested successfully: the fleet count increased from 4 to 5, `E2E Fixed Bus 039156` appeared in the bus list, and the generated Bus QR modal opened.

## Driver GPS Evidence

Driver login and active trip visibility passed. GPS was confirmed working on a real phone with location permission enabled. The earlier desktop browser timeout was an environment limitation and is not considered an app blocker.

## Resolved And Remaining Notes

| Status | Issue | Impact | Recommendation |
| --- | --- | --- | --- |
| Resolved | Operator Add Bus did not save from hosted UI | Operator could not add new buses during demo/production use | Fixed, redeployed, and retested successfully |
| Resolved | Driver GPS timed out in desktop browser test | Desktop browser could not confirm live tracking | Confirmed working on real phone |
| Remaining note | Test-created route/staff/bus remain in live database | Demo data may appear in client environment | Keep for audit or clean up before final client walkthrough |

## Production Readiness Notes

The passenger payment and ticket verification journey is demo-ready. The staff dashboards are substantially improved, operator bus creation is now working after redeploy, and GPS live tracking has been confirmed on phone.

Secrets, service keys, and deployment tokens are intentionally excluded from this report.
