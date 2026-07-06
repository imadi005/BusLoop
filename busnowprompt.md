Build a real-time bus tracking system called **BusNow**. The system consists of two separate applications: a **User App** and a **Staff App**, both connected to a shared backend (preferably Supabase for database, auth, and real-time subscriptions).

The goal is to create a minimal, functional MVP that allows users to track buses live and allows staff to broadcast bus location and manage trips.

---

### 🧑‍💻 Tech Stack

* Frontend: React (with TanStack Query for data fetching and caching)
* Backend: Supabase (Auth, Postgres DB, Realtime)
* Optional: Map integration (Google Maps or Mapbox)

---

## 📱 User App (Passenger Side)

### Core Features:

1. **Authentication**

   * Email/password login using Supabase Auth
   * Basic session handling (login/logout)

2. **Bus Tracking**

   * Show list of available buses/routes
   * Select a bus to view:

     * Live location on map
     * Current status (active/inactive)
     * Estimated arrival (simple calculation or placeholder)

3. **Route & Stops**

   * Display assigned stops for a bus
   * Highlight current bus position relative to stops

4. **Real-Time Updates**

   * Subscribe to live location updates using Supabase Realtime
   * UI should update automatically when driver location changes

5. **Simple UI Requirements**

   * Clean dashboard
   * Bus list → Bus detail view
   * Map view with moving marker

---

## 🧑‍✈️ Staff App (Driver/Admin Side)

This app has **3 roles**:

* Driver
* Manager/Admin
* Super Admin (basic control, optional for MVP but structure should allow it)

---

### Driver Features:

1. Login (Supabase Auth)
2. Select assigned bus/route
3. Start Trip / End Trip button
4. Send live GPS location at intervals
5. Update status (active, delayed, stopped)

---

### Manager/Admin Features:

1. View all buses and their current status
2. See live locations of active buses
3. Assign routes to drivers
4. Basic control panel (no heavy analytics needed)

---

### Super Admin (Minimal Structure Only):

* Role management (can be simple DB role field)
* No need for full UI complexity in MVP

---

## 🔄 Core System Flow

* Driver logs in → selects bus → starts trip
* Driver app continuously sends location to Supabase
* User app subscribes to that data and displays it live
* Manager can monitor all buses in real time

---

## 🗂️ Project Structure

Keep apps separate:

/busnow-user-app
/busnow-staff-app
/backend (optional if needed, otherwise Supabase handles backend)

Ensure clean separation of concerns.

---

## 🧱 Database (Basic Tables)

* users (id, role)
* buses (id, name, route_id)
* routes (id, name)
* stops (id, route_id, name, lat, lng)
* trips (id, bus_id, driver_id, status)
* locations (id, trip_id, lat, lng, timestamp)

---

## ⚠️ Constraints

* Do NOT overbuild
* Focus only on working real-time tracking
* No complex analytics, payments, or AI features
* Keep UI simple but functional

---

## 🎯 Goal

Deliver a working MVP where:

* A driver can start a trip and send location
* A user can see the bus moving live on a map
* Data syncs in real time with minimal delay

---