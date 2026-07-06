// BusNow Migration â€” applies schema to Supabase via direct PostgreSQL connection
// Uses the Supabase pg REST endpoint
// Run: node run-migration.js

const https = require('https');

const PROJECT_REF = 'qsmmstpkidrmecevtrwv';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Refusing to run with an embedded secret.');
  process.exit(1);
}

function makeRequest(path, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: `${PROJECT_REF}.supabase.co`,
      port: 443,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=minimal',
        ...headers,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Full SQL migration in one block
const MIGRATION_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS TABLE
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

-- ROUTES TABLE
CREATE TABLE IF NOT EXISTS public.routes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#E53E3E',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- STOPS TABLE
CREATE TABLE IF NOT EXISTS public.stops (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id    UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  lat         DECIMAL(10, 8) NOT NULL,
  lng         DECIMAL(11, 8) NOT NULL,
  stop_order  INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BUSES TABLE
CREATE TABLE IF NOT EXISTS public.buses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  registration_no TEXT UNIQUE NOT NULL,
  route_id        UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  capacity        INTEGER DEFAULT 50,
  status          TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'maintenance', 'delayed', 'stopped')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TRIPS TABLE
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

-- LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS public.locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id     UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  lat         DECIMAL(10, 8) NOT NULL,
  lng         DECIMAL(11, 8) NOT NULL,
  speed       DECIMAL(5, 2),
  heading     DECIMAL(5, 2),
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TICKETS TABLE
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

-- REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.reviews (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  passenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bus_id       UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  trip_id      UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS stops_route_id_idx    ON public.stops(route_id);
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

-- Enable RLS
ALTER TABLE public.users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stops     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews   ENABLE ROW LEVEL SECURITY;

-- â•â•â• RLS POLICIES â•â•â•

-- Users
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Users can view own profile') THEN CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Users can update own profile') THEN CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Users can insert own profile') THEN CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id); END IF; END $$;

-- Routes + Stops (public read)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='routes' AND policyname='Anyone can view routes') THEN CREATE POLICY "Anyone can view routes" ON public.routes FOR SELECT USING (TRUE); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stops'  AND policyname='Anyone can view stops')  THEN CREATE POLICY "Anyone can view stops"  ON public.stops  FOR SELECT USING (TRUE); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='routes' AND policyname='Operators manage routes') THEN CREATE POLICY "Operators manage routes" ON public.routes FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('operator','super_admin'))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stops'  AND policyname='Operators manage stops')  THEN CREATE POLICY "Operators manage stops"  ON public.stops  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('operator','super_admin'))); END IF; END $$;

-- Buses (public read)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='buses' AND policyname='Anyone can view buses') THEN CREATE POLICY "Anyone can view buses" ON public.buses FOR SELECT USING (TRUE); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='buses' AND policyname='Operators manage buses') THEN CREATE POLICY "Operators manage buses" ON public.buses FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('operator','super_admin'))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='buses' AND policyname='Drivers update bus status') THEN CREATE POLICY "Drivers update bus status" ON public.buses FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'driver')); END IF; END $$;

-- Trips
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trips' AND policyname='Anyone can view active trips') THEN CREATE POLICY "Anyone can view active trips" ON public.trips FOR SELECT USING (status = 'active'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trips' AND policyname='Drivers manage own trips') THEN CREATE POLICY "Drivers manage own trips" ON public.trips FOR ALL USING (auth.uid() = driver_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trips' AND policyname='Operators view all trips') THEN CREATE POLICY "Operators view all trips" ON public.trips FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('operator','super_admin'))); END IF; END $$;

-- Locations (public read, drivers insert)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='locations' AND policyname='Anyone can view locations') THEN CREATE POLICY "Anyone can view locations" ON public.locations FOR SELECT USING (TRUE); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='locations' AND policyname='Drivers insert locations') THEN CREATE POLICY "Drivers insert locations" ON public.locations FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND driver_id = auth.uid())); END IF; END $$;

-- Tickets
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tickets' AND policyname='Passengers view own tickets') THEN CREATE POLICY "Passengers view own tickets" ON public.tickets FOR SELECT USING (auth.uid() = passenger_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tickets' AND policyname='Checkers view all tickets') THEN CREATE POLICY "Checkers view all tickets" ON public.tickets FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('checker','operator','super_admin'))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tickets' AND policyname='Checkers update ticket status') THEN CREATE POLICY "Checkers update ticket status" ON public.tickets FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('checker','operator','super_admin'))); END IF; END $$;

-- Reviews (public read)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Anyone can view reviews') THEN CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (TRUE); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Passengers insert reviews') THEN CREATE POLICY "Passengers insert reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = passenger_id); END IF; END $$;

-- Enable Realtime  
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.buses;

-- Seed: Routes
INSERT INTO public.routes (id, name, description, color, is_active) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Route 1 â€” City Center to Airport', 'Main airport shuttle route', '#E53E3E', TRUE),
  ('11111111-0000-0000-0000-000000000002', 'Route 2 â€” University Loop', 'Campus circular route', '#3182CE', TRUE),
  ('11111111-0000-0000-0000-000000000003', 'Route 3 â€” North-South Expressway', 'Cross-city express', '#38A169', TRUE)
ON CONFLICT DO NOTHING;

-- Seed: Stops Route 1
INSERT INTO public.stops (route_id, name, lat, lng, stop_order) VALUES
  ('11111111-0000-0000-0000-000000000001', 'City Center',        13.05500000, 77.61000000, 1),
  ('11111111-0000-0000-0000-000000000001', 'Kannuru Junction',    13.04800000, 77.61500000, 2),
  ('11111111-0000-0000-0000-000000000001', 'Nagaraesh Lake',      13.04200000, 77.62000000, 3),
  ('11111111-0000-0000-0000-000000000001', 'Hennur Basavur Road', 13.03950000, 77.62400000, 4),
  ('11111111-0000-0000-0000-000000000001', 'Airport Terminal',    13.02000000, 77.63500000, 5)
ON CONFLICT DO NOTHING;

-- Seed: Stops Route 2
INSERT INTO public.stops (route_id, name, lat, lng, stop_order) VALUES
  ('11111111-0000-0000-0000-000000000002', 'Main Gate',      13.04200000, 77.61800000, 1),
  ('11111111-0000-0000-0000-000000000002', 'Library Block',  13.04300000, 77.61600000, 2),
  ('11111111-0000-0000-0000-000000000002', 'Hostel Block',   13.04400000, 77.61400000, 3),
  ('11111111-0000-0000-0000-000000000002', 'Sports Complex', 13.04500000, 77.61300000, 4)
ON CONFLICT DO NOTHING;

-- Seed: Buses
INSERT INTO public.buses (name, registration_no, route_id, capacity, status) VALUES
  ('Bus 42', 'MZ-01-AB-4200', '11111111-0000-0000-0000-000000000001', 50, 'inactive'),
  ('Bus 17', 'MZ-01-CD-1700', '11111111-0000-0000-0000-000000000002', 40, 'inactive'),
  ('Bus 88', 'MZ-01-EF-8800', NULL,                                    60, 'inactive'),
  ('Bus 5',  'MZ-01-GH-0500', '11111111-0000-0000-0000-000000000001', 50, 'inactive')
ON CONFLICT DO NOTHING;
`;

async function applyMigration() {
  console.log('ðŸš€ BusNow â€” Applying migration to Supabase...\n');
  
  // Use Supabase's pg endpoint that accepts raw SQL via service role
  const dbPassword = process.argv[2];
  
  if (!dbPassword) {
    console.log('â„¹ï¸  Trying via Supabase REST API...');
    // Try using the pg function via RPC  
    try {
      const res = await makeRequest('/rest/v1/rpc/exec', 'POST', { sql: MIGRATION_SQL });
      if (res.status < 400) {
        console.log('âœ… Migration applied via RPC');
      } else {
        throw new Error(res.body);
      }
    } catch (e) {
      console.error('âŒ RPC failed:', e.message);
      console.log('\nðŸ“‹ Please run the SQL manually in the Supabase SQL editor:');
      console.log('   https://supabase.com/dashboard/project/qsmmstpkidrmecevtrwv/sql/new');
    }
    return;
  }
}

function makeRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: `${PROJECT_REF}.supabase.co`,
      port: 443,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

applyMigration();

