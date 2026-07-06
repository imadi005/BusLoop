# BusNOW Final E2E Checklist

Run this once on the final demo/prod deployment after rotating secrets.

## Passenger Flow
- [ ] Passenger signs up with a new account.
- [ ] Passenger logs out and logs back in.
- [ ] Home map loads without demo/mock buses when demo mode is off.
- [ ] User taps Scan and scans a bus QR.
- [ ] Bus detail page opens for the scanned bus.
- [ ] Route, fare, capacity, and status are readable on mobile.
- [ ] User books a ticket with Razorpay test card.
- [ ] Successful payment creates one ticket only.
- [ ] Ticket modal shows QR, ticket code, validity, and no-refund notice.
- [ ] Ticket appears in Active tickets.

## Ticket Validity
- [ ] Fresh ticket verifies successfully.
- [ ] Checker marks ticket boarded.
- [ ] Used ticket moves to Used section.
- [ ] Used ticket shows boarding time.
- [ ] Expired ticket appears in Expired section.
- [ ] Expired ticket is rejected by checker.
- [ ] Re-scanning a used ticket is rejected.

## Staff Flow
- [ ] Operator login works.
- [ ] Operator adds bus and sees generated bus QR.
- [ ] Operator assigns route.
- [ ] Driver login works.
- [ ] Driver selects bus and starts trip.
- [ ] Driver GPS permission prompt appears on HTTPS.
- [ ] Passenger home shows live bus.
- [ ] Operator Live button opens GPS map for active bus.
- [ ] Checker login works.
- [ ] Checker sees active bus.
- [ ] Checker can show bus booking QR.
- [ ] Checker camera scans passenger ticket QR.

## Payment Safety
- [ ] Failed/cancelled Razorpay payment does not create a ticket.
- [ ] Duplicate Razorpay callback does not create duplicate ticket.
- [ ] Ticket amount matches selected fare.
- [ ] Payment history row links to ticket.

## Mobile UX
- [ ] User app works on Android Chrome.
- [ ] Staff app works on Android Chrome.
- [ ] Camera scanner works over HTTPS.
- [ ] QR modal scrolls on small screens.
- [ ] Bottom navigation does not block primary actions.

## Final Sign-Off
- [ ] `npm run build` passes in user app.
- [ ] `npm run build` passes in staff app.
- [ ] `npm audit --json` shows 0 vulnerabilities in both apps.
- [ ] `npm run check:release` passes with production env.
