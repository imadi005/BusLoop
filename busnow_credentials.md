# BusNOW â€” Credentials & System Reference

## ðŸ‘¥ Staff App Credentials

> All staff accounts are **pre-created in Supabase Auth** â€” they cannot self-register.
> The login page now shows credential hints to guide staff members.

### ðŸŸ  Operators (Fleet Management)
| Name | Email | Password |
|------|-------|----------|
| Arjun Sharma | `operator1@busnow.app` | `<set in STAFF_DEMO_PASSWORD>` |
| Priya Nair | `operator2@busnow.app` | `<set in STAFF_DEMO_PASSWORD>` |

### ðŸ”µ Drivers (Live GPS Tracking)
| Name | Email | Password |
|------|-------|----------|
| Ravi Kumar | `driver1@busnow.app` | `<set in STAFF_DEMO_PASSWORD>` |
| Anita Singh | `driver2@busnow.app` | `<set in STAFF_DEMO_PASSWORD>` |

### ðŸŸ¢ Checkers (Ticket Verification)  
| Name | Email | Password |
|------|-------|----------|
| Anand Sharma | `checker1@busnow.app` | `<set in STAFF_DEMO_PASSWORD>` |
| Divya Lalrinpuii | `checker2@busnow.app` | `<set in STAFF_DEMO_PASSWORD>` |

---

## ðŸ“± User App (Passengers)

Users **self-register** via Sign Up on the user app. Each user:
- Creates their own account with email + password
- Gets a `passenger` role automatically via the `handle_new_user` DB trigger
- Has **fully isolated data** â€” tickets and reviews are scoped by `passenger_id = auth.uid()`

### User App URL: `http://localhost:5173`
### Staff App URL: `http://localhost:5174`

---

## ðŸ”’ How Data Isolation Works

| Data | Who Can See It |
|------|----------------|
| **Profile** | Only yourself (+ staff for operational needs) |
| **Tickets** | Only your own tickets (checkers/operators can also read for verification) |
| **Reviews** | Everyone can read; only you can write/edit your own |
| **Bus locations** | Everyone (public) |
| **Trip data** | Active trips are public; full history is operator-only |
| **Staff can't touch** | Other users' tickets, profiles, or data |

---

## ðŸ”‘ Role Permissions Matrix

| Feature | Passenger | Driver | Checker | Operator |
|---------|-----------|--------|---------|----------|
| View buses & routes | âœ… | âœ… | âœ… | âœ… |
| Book tickets | âœ… | âŒ | âŒ | âŒ |
| Write reviews | âœ… | âŒ | âŒ | âŒ |
| Start/end trips | âŒ | âœ… | âŒ | âŒ |
| Share GPS location | âŒ | âœ… | âŒ | âŒ |
| Verify tickets | âŒ | âŒ | âœ… | âœ… |
| Manage buses/routes | âŒ | âŒ | âŒ | âœ… |
| Add buses | âŒ | âŒ | âŒ | âœ… |
| View all staff | âŒ | âŒ | âŒ | âœ… |

---

## âœ… Changes Made This Session

### Database
- âœ… Created 6 staff accounts in `auth.users` + `public.users` (confirmed, email pre-verified)
- âœ… Added `tickets.used_at` column
- âœ… Added `generate_ticket_qr()` trigger â€” QR codes are auto-generated on ticket insert
- âœ… Added `users INSERT` policy so signup trigger can safely create profiles

### Staff App
- âœ… **StaffLoginPage** â€” Fetches actual DB role right after login, redirects to correct dashboard regardless of which role was selected. Shows credential hints.
- âœ… **DriverDashboard** â€” Now properly resumes an active trip on re-load; picks up the correct bus from the active trip
- âœ… **Security** â€” Role escalation is impossible; passengers are rejected from the staff app

### User App
- âœ… **HomePage** â€” Personalized greeting, `UserLocateButton` for GPS, improved bus marker styling, real-time bus status subscription
- âœ… **SearchPage** â€” Now loads real buses from Supabase (was 100% mock)
- âœ… **TicketsPage** â€” Loads real user tickets from DB (was 100% mock)
- âœ… **AuthContext** â€” Race condition fix, `updateProfile()` method added
- âœ… **All routes** guarded with `AuthRequired` â€” unauthenticated users go to `/login`

---

## ðŸš€ Running Locally

```powershell
# Terminal 1 â€” User App
cd busnow-user-app
npm run dev   # â†’ http://localhost:5173

# Terminal 2 â€” Staff App
cd busnow-staff-app
npm run dev   # â†’ http://localhost:5174
```

