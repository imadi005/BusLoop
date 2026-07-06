-- BusNow Initial Schema Migration
-- Migration: 001_initial_schema.sql
-- Created: 2026-04-11
-- Apply with: Supabase Dashboard > SQL Editor, or supabase db push

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- Extends Supabase auth.users with role and profile data
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  email       TEXT UNIQUE NOT NULL,
  role        TEXT NOT NULL DEFAULT 'passenger' CHECK (role IN ('passenger', 'driver', 'checker', 'operator', 'super_admin')),
  avatar_url  TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: users can read their own row; staff can read all
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- ROUTES TABLE
-- Bus routes (e.g. Route 1: City Center → Airport)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.routes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#E53E3E',   -- For map display
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view routes" ON public.routes FOR SELECT USING (TRUE);
CREATE POLICY "Operators can manage routes" ON public.routes FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('operator', 'super_admin'))
);

-- ============================================================
-- STOPS TABLE
-- Individual stops along a route with GPS coordinates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stops (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id    UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  lat         DECIMAL(10, 8) NOT NULL,
  lng         DECIMAL(11, 8) NOT NULL,
  stop_order  INTEGER NOT NULL,  -- Order along the route
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stops_route_id_idx ON public.stops(route_id);
CREATE INDEX IF NOT EXISTS stops_order_idx ON public.stops(route_id, stop_order);

ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view stops" ON public.stops FOR SELECT USING (TRUE);
CREATE POLICY "Operators can manage stops" ON public.stops FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('operator', 'super_admin'))
);

-- ============================================================
-- BUSES TABLE
-- Physical bus vehicles registered in the system
-- ============================================================
CREATE TABLE IF NOT EXISTS public.buses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,           -- e.g. "Bus 42"
  registration_no TEXT UNIQUE NOT NULL,    -- e.g. "MZ-01-AB-1234"
  route_id        UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  capacity        INTEGER DEFAULT 50,
  status          TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'maintenance', 'delayed', 'stopped')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS buses_route_id_idx ON public.buses(route_id);
CREATE INDEX IF NOT EXISTS buses_status_idx ON public.buses(status);

ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view buses" ON public.buses FOR SELECT USING (TRUE);
CREATE POLICY "Operators can manage buses" ON public.buses FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('operator', 'super_admin'))
);

-- ============================================================
-- TRIPS TABLE
-- Active or completed trip instances
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trips (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_id      UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  driver_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  checker_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  route_id    UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  started_at  TIMESTAMPTZ,
  ended_at    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trips_bus_id_idx ON public.trips(bus_id);
CREATE INDEX IF NOT EXISTS trips_driver_id_idx ON public.trips(driver_id);
CREATE INDEX IF NOT EXISTS trips_status_idx ON public.trips(status);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active trips" ON public.trips FOR SELECT USING (status = 'active');
CREATE POLICY "Drivers can manage own trips" ON public.trips FOR ALL USING (auth.uid() = driver_id);
CREATE POLICY "Operators can view all trips" ON public.trips FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('operator', 'super_admin'))
);

-- ============================================================
-- LOCATIONS TABLE
-- GPS location heartbeat from driver during active trip
-- ============================================================
CREATE TABLE IF NOT EXISTS public.locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id     UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  lat         DECIMAL(10, 8) NOT NULL,
  lng         DECIMAL(11, 8) NOT NULL,
  speed       DECIMAL(5, 2),              -- km/h
  heading     DECIMAL(5, 2),              -- degrees 0-360
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS locations_trip_id_idx ON public.locations(trip_id);
CREATE INDEX IF NOT EXISTS locations_timestamp_idx ON public.locations(trip_id, timestamp DESC);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view locations" ON public.locations FOR SELECT USING (TRUE);
CREATE POLICY "Drivers can insert own trip locations" ON public.locations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND driver_id = auth.uid())
);

-- ============================================================
-- TICKETS TABLE
-- Passenger tickets for trips (for QR verification)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  passenger_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trip_id       UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  route_id      UUID REFERENCES public.routes(id),
  from_stop_id  UUID REFERENCES public.stops(id),
  to_stop_id    UUID REFERENCES public.stops(id),
  qr_code       TEXT UNIQUE NOT NULL DEFAULT uuid_generate_v4()::TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  booked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS tickets_passenger_id_idx ON public.tickets(passenger_id);
CREATE INDEX IF NOT EXISTS tickets_qr_code_idx ON public.tickets(qr_code);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Passengers can view own tickets" ON public.tickets FOR SELECT USING (auth.uid() = passenger_id);
CREATE POLICY "Checkers can view all tickets" ON public.tickets FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('checker', 'operator', 'super_admin'))
);
CREATE POLICY "Checkers can update ticket status" ON public.tickets FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('checker', 'operator', 'super_admin'))
);

-- ============================================================
-- REVIEWS TABLE
-- Passenger reviews for bus trips
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  passenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bus_id      UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  trip_id     UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reviews_bus_id_idx ON public.reviews(bus_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (TRUE);
CREATE POLICY "Passengers can insert own reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = passenger_id);

-- ============================================================
-- Realtime: Enable publication for live location tracking
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.buses;

-- ============================================================
-- Seed: Sample data for development/testing
-- ============================================================
-- Sample routes
INSERT INTO public.routes (id, name, description, color) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Route 1 — City Center → Airport', 'Main airport shuttle route', '#E53E3E'),
  ('11111111-0000-0000-0000-000000000002', 'Route 2 — University Loop', 'Campus circular route', '#3182CE'),
  ('11111111-0000-0000-0000-000000000003', 'Route 3 — North-South Expressway', 'Cross-city express', '#38A169')
ON CONFLICT DO NOTHING;
