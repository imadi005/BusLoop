-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────────
-- TABLE: public.users (Passengers)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  email       TEXT UNIQUE NOT NULL,
  role        TEXT NOT NULL DEFAULT 'passenger' CHECK (role = 'passenger'),
  avatar_url  TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- ────────────────────────────────────────────────────────────────
-- TABLE: public.staff (Pre-created Employees)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT UNIQUE NOT NULL,
  full_name      TEXT,
  role           TEXT NOT NULL CHECK (role IN ('operator', 'driver', 'checker', 'super_admin')),
  is_terminated  BOOLEAN DEFAULT FALSE,
  phone          TEXT,
  employee_id    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for public.staff
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view own profile" ON public.staff;
DROP POLICY IF EXISTS "Operators manage staff" ON public.staff;

CREATE POLICY "Staff can view own profile" ON public.staff FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Operators manage staff" ON public.staff FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.staff WHERE id = auth.uid() AND role IN ('operator', 'super_admin')
  )
);

-- ────────────────────────────────────────────────────────────────
-- TABLE: public.routes
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.routes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  description     TEXT,
  color           TEXT DEFAULT '#E53E3E',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  origin          TEXT,
  destination     TEXT,
  landmarks       TEXT,
  notes           TEXT,
  search_keywords TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for public.routes
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view routes" ON public.routes;
DROP POLICY IF EXISTS "Operators manage routes" ON public.routes;

CREATE POLICY "Anyone can view routes" ON public.routes FOR SELECT USING (TRUE);
CREATE POLICY "Operators manage routes" ON public.routes FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.staff WHERE id = auth.uid() AND role IN ('operator', 'super_admin')
  )
);

-- ────────────────────────────────────────────────────────────────
-- TABLE: public.stops
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stops (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id    UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  lat         DECIMAL(10, 8) NOT NULL,
  lng         DECIMAL(11, 8) NOT NULL,
  stop_order  INTEGER NOT NULL,
  stop_type   TEXT NOT NULL DEFAULT 'stop' CHECK (stop_type IN ('stop', 'landmark')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for public.stops
ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view stops" ON public.stops;
DROP POLICY IF EXISTS "Operators manage stops" ON public.stops;

CREATE POLICY "Anyone can view stops" ON public.stops FOR SELECT USING (TRUE);
CREATE POLICY "Operators manage stops" ON public.stops FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.staff WHERE id = auth.uid() AND role IN ('operator', 'super_admin')
  )
);

-- ────────────────────────────────────────────────────────────────
-- TABLE: public.buses
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.buses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  registration_no TEXT UNIQUE NOT NULL,
  route_id        UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  capacity        INTEGER DEFAULT 50,
  status          TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'maintenance', 'delayed', 'stopped')),
  photo_url       TEXT,
  destination     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for public.buses
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view buses" ON public.buses;
DROP POLICY IF EXISTS "Operators manage buses" ON public.buses;
DROP POLICY IF EXISTS "Drivers update bus status" ON public.buses;

CREATE POLICY "Anyone can view buses" ON public.buses FOR SELECT USING (TRUE);
CREATE POLICY "Operators manage buses" ON public.buses FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.staff WHERE id = auth.uid() AND role IN ('operator', 'super_admin')
  )
);
CREATE POLICY "Drivers update bus status" ON public.buses FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.staff WHERE id = auth.uid() AND role = 'driver'
  )
);

-- ────────────────────────────────────────────────────────────────
-- TABLE: public.trips
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trips (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_id        UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  driver_id     UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  checker_id    UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  route_id      UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  from_location TEXT,
  to_location   TEXT,
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for public.trips
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active trips" ON public.trips;
DROP POLICY IF EXISTS "Staff can manage own trips" ON public.trips;
DROP POLICY IF EXISTS "Operators can manage all trips" ON public.trips;

CREATE POLICY "Anyone can view active trips" ON public.trips FOR SELECT USING (status = 'active');
CREATE POLICY "Staff can manage own trips" ON public.trips FOR ALL USING (auth.uid() = driver_id);
CREATE POLICY "Operators can manage all trips" ON public.trips FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.staff WHERE id = auth.uid() AND role IN ('operator', 'super_admin')
  )
);

-- ────────────────────────────────────────────────────────────────
-- TABLE: public.locations
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id     UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  lat         DECIMAL(10, 8) NOT NULL,
  lng         DECIMAL(11, 8) NOT NULL,
  speed       DECIMAL(5, 2),
  heading     DECIMAL(5, 2),
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for public.locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view locations" ON public.locations;
DROP POLICY IF EXISTS "Staff can insert trip locations" ON public.locations;

CREATE POLICY "Anyone can view locations" ON public.locations FOR SELECT USING (TRUE);
CREATE POLICY "Staff can insert trip locations" ON public.locations FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.trips WHERE id = trip_id AND driver_id = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────────
-- TABLE: public.tickets
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tickets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  passenger_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trip_id       UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  route_id      UUID REFERENCES public.routes(id),
  from_stop_id  UUID REFERENCES public.stops(id),
  to_stop_id    UUID REFERENCES public.stops(id),
  qr_code       TEXT UNIQUE NOT NULL DEFAULT uuid_generate_v4()::TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  amount        NUMERIC(10, 2) DEFAULT 0,
  booked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at       TIMESTAMPTZ
);

-- RLS for public.tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Passengers can view own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Checkers can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Checkers can update ticket status" ON public.tickets;

CREATE POLICY "Passengers can view own tickets" ON public.tickets FOR SELECT USING (auth.uid() = passenger_id);
CREATE POLICY "Checkers can view all tickets" ON public.tickets FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.staff WHERE id = auth.uid() AND role IN ('checker', 'operator', 'super_admin')
  )
);
CREATE POLICY "Checkers can update ticket status" ON public.tickets FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.staff WHERE id = auth.uid() AND role IN ('checker', 'operator', 'super_admin')
  )
);

-- ────────────────────────────────────────────────────────────────
-- TABLE: public.reviews
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  passenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bus_id       UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  trip_id      UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for public.reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Passengers can insert own reviews" ON public.reviews;

CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (TRUE);
CREATE POLICY "Passengers can insert own reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = passenger_id);

-- ────────────────────────────────────────────────────────────────
-- TABLE: public.route_presets
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.route_presets (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type       TEXT NOT NULL CHECK (type IN ('location','stop','landmark','keyword')),
  label      TEXT NOT NULL,
  lat        DECIMAL(10,8),
  lng        DECIMAL(11,8),
  use_count  INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for public.route_presets
ALTER TABLE public.route_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view presets" ON public.route_presets;
DROP POLICY IF EXISTS "Operators manage presets" ON public.route_presets;

CREATE POLICY "Anyone can view presets" ON public.route_presets FOR SELECT USING (TRUE);
CREATE POLICY "Operators manage presets" ON public.route_presets FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.staff WHERE id = auth.uid() AND role IN ('operator','super_admin','driver')
  )
);

-- ────────────────────────────────────────────────────────────────
-- TABLE: public.operator_settings
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.operator_settings (
  id          SERIAL PRIMARY KEY,
  upi_id      TEXT,
  upi_name    TEXT,
  fare_note   TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS for public.operator_settings
ALTER TABLE public.operator_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can read settings" ON public.operator_settings;
DROP POLICY IF EXISTS "authenticated can update" ON public.operator_settings;

CREATE POLICY "anyone can read settings" ON public.operator_settings FOR SELECT USING (true);
CREATE POLICY "authenticated can update" ON public.operator_settings FOR UPDATE USING (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS stops_route_id_idx    ON public.stops(route_id);
CREATE INDEX IF NOT EXISTS stops_order_idx       ON public.stops(route_id, stop_order);
CREATE INDEX IF NOT EXISTS buses_route_id_idx    ON public.buses(route_id);
CREATE INDEX IF NOT EXISTS buses_status_idx      ON public.buses(status);
CREATE INDEX IF NOT EXISTS trips_bus_id_idx      ON public.trips(bus_id);
CREATE INDEX IF NOT EXISTS trips_driver_id_idx   ON public.trips(driver_id);
CREATE INDEX IF NOT EXISTS trips_status_idx      ON public.trips(status);
CREATE INDEX IF NOT EXISTS locations_trip_id_idx ON public.locations(trip_id);
CREATE INDEX IF NOT EXISTS locations_ts_idx      ON public.locations(trip_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS tickets_passenger_idx ON public.tickets(passenger_id);
CREATE INDEX IF NOT EXISTS tickets_qr_idx        ON public.tickets(qr_code);
CREATE INDEX IF NOT EXISTS reviews_bus_id_idx    ON public.reviews(bus_id);
CREATE INDEX IF NOT EXISTS route_presets_type_idx ON public.route_presets(type);

-- ────────────────────────────────────────────────────────────────
-- REALTIME
-- ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.buses;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- SEED DATA
-- ────────────────────────────────────────────────────────────────

-- 1. Routes
INSERT INTO public.routes (id, name, description, color, origin, destination, landmarks, notes, search_keywords) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Route 1 — City Center to Airport', 'Main airport shuttle route', '#E53E3E', 'City Center', 'Airport Terminal', 'Nagaraesh Lake, Hennur Basavur Road', 'Express route — limited stops between Kannuru and Airport', 'airport shuttle city center terminal kannuru'),
  ('11111111-0000-0000-0000-000000000002', 'Route 2 — University Loop', 'Campus circular route', '#3182CE', 'Main Gate', 'Main Gate', 'Library Block, Sports Complex', 'Circular route — runs every 15 minutes on weekdays', 'university campus library hostel sports'),
  ('11111111-0000-0000-0000-000000000003', 'Route 3 — North-South Expressway', 'Cross-city express', '#38A169', 'North Terminal', 'South Terminal', 'Central Park, City Mall', 'Limited stops — only at designated express stops', 'express north south city mall central park')
ON CONFLICT (id) DO UPDATE SET
  origin = EXCLUDED.origin,
  destination = EXCLUDED.destination,
  landmarks = EXCLUDED.landmarks,
  notes = EXCLUDED.notes,
  search_keywords = EXCLUDED.search_keywords;

-- 2. Stops
INSERT INTO public.stops (route_id, name, lat, lng, stop_order, stop_type) VALUES
  ('11111111-0000-0000-0000-000000000001', 'City Center',        13.05500000, 77.61000000, 1, 'stop'),
  ('11111111-0000-0000-0000-000000000001', 'Kannuru Junction',    13.04800000, 77.61500000, 2, 'stop'),
  ('11111111-0000-0000-0000-000000000001', 'Nagaraesh Lake',      13.04200000, 77.62000000, 3, 'landmark'),
  ('11111111-0000-0000-0000-000000000001', 'Hennur Basavur Road', 13.03950000, 77.62400000, 4, 'landmark'),
  ('11111111-0000-0000-0000-000000000001', 'Airport Terminal',    13.02000000, 77.63500000, 5, 'stop'),

  ('11111111-0000-0000-0000-000000000002', 'Main Gate',          13.04200000, 77.61800000, 1, 'stop'),
  ('11111111-0000-0000-0000-000000000002', 'Library Block',      13.04300000, 77.61600000, 2, 'stop'),
  ('11111111-0000-0000-0000-000000000002', 'Hostel Block',       13.04400000, 77.61400000, 3, 'stop'),
  ('11111111-0000-0000-0000-000000000002', 'Sports Complex',     13.04500000, 77.61300000, 4, 'stop')
ON CONFLICT DO NOTHING;

-- 3. Buses
INSERT INTO public.buses (name, registration_no, route_id, capacity, status) VALUES
  ('Bus 42', 'MZ-01-AB-4200', '11111111-0000-0000-0000-000000000001', 50, 'inactive'),
  ('Bus 17', 'MZ-01-CD-1700', '11111111-0000-0000-0000-000000000002', 40, 'inactive'),
  ('Bus 88', 'MZ-01-EF-8800', NULL,                                    60, 'inactive'),
  ('Bus 5',  'MZ-01-GH-0500', '11111111-0000-0000-0000-000000000001', 50, 'inactive')
ON CONFLICT (registration_no) DO UPDATE SET
  route_id = EXCLUDED.route_id,
  capacity = EXCLUDED.capacity;

-- 4. Route Presets
INSERT INTO public.route_presets (type, label, lat, lng, use_count) VALUES
  ('location', 'City Center',        13.05500, 77.61000, 5),
  ('location', 'Airport Terminal',   13.02000, 77.63500, 5),
  ('location', 'Main Gate',          13.04200, 77.61800, 3),
  ('location', 'Library Block',      13.04300, 77.61600, 2),
  ('location', 'Hostel Block',       13.04400, 77.61400, 2),
  ('location', 'Sports Complex',     13.04500, 77.61300, 2),
  ('location', 'North Terminal',     13.06000, 77.60000, 2),
  ('location', 'South Terminal',     13.00000, 77.62000, 2),
  ('stop',     'City Center',        13.05500, 77.61000, 5),
  ('stop',     'Airport Terminal',   13.02000, 77.63500, 5),
  ('stop',     'Kannuru Junction',   13.04800, 77.61500, 4),
  ('stop',     'Main Gate',          13.04200, 77.61800, 3),
  ('stop',     'Library Block',      13.04300, 77.61600, 2),
  ('landmark', 'Nagaraesh Lake',     13.04200, 77.62000, 3),
  ('landmark', 'Central Park',       13.04600, 77.62000, 2),
  ('landmark', 'City Mall',          13.05000, 77.61500, 2),
  ('keyword',  'airport',            NULL, NULL, 5),
  ('keyword',  'university',         NULL, NULL, 4),
  ('keyword',  'express',            NULL, NULL, 3),
  ('keyword',  'campus',             NULL, NULL, 3),
  ('keyword',  'shuttle',            NULL, NULL, 2)
ON CONFLICT DO NOTHING;

-- 5. Operator Settings
INSERT INTO public.operator_settings (id, upi_id, upi_name)
VALUES (1, '', 'BusNOW Operator')
ON CONFLICT (id) DO NOTHING;
