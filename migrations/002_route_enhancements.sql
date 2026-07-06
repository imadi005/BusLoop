-- BusNow Migration 002 — Route Enhancements + Smart Presets
-- Apply via: https://supabase.com/dashboard/project/qsmmstpkidrmecevtrwv/sql/new

-- 1. Add new columns to routes
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS origin TEXT;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS destination TEXT;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS landmarks TEXT;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS search_keywords TEXT;

-- 2. Add stop_type to stops (stop vs landmark)
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS stop_type TEXT NOT NULL DEFAULT 'stop';

-- 3. Create route_presets table
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

ALTER TABLE public.route_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view presets" ON public.route_presets
  FOR SELECT USING (TRUE);

CREATE POLICY "Operators manage presets" ON public.route_presets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('operator','super_admin','driver'))
  );

CREATE INDEX IF NOT EXISTS route_presets_type_idx ON public.route_presets(type);

-- 4. Seed routes with origin/destination/landmarks/notes
UPDATE public.routes SET
  origin      = 'City Center',
  destination = 'Airport Terminal',
  landmarks   = 'Nagaraesh Lake, Hennur Basavur Road',
  notes       = 'Express route — limited stops between Kannuru and Airport',
  search_keywords = 'airport shuttle city center terminal kannuru'
WHERE id = '11111111-0000-0000-0000-000000000001';

UPDATE public.routes SET
  origin      = 'Main Gate',
  destination = 'Main Gate',
  landmarks   = 'Library Block, Sports Complex',
  notes       = 'Circular route — runs every 15 minutes on weekdays',
  search_keywords = 'university campus library hostel sports'
WHERE id = '11111111-0000-0000-0000-000000000002';

UPDATE public.routes SET
  origin      = 'North Terminal',
  destination = 'South Terminal',
  landmarks   = 'Central Park, City Mall',
  notes       = 'Limited stops — only at designated express stops',
  search_keywords = 'express north south city mall central park'
WHERE id = '11111111-0000-0000-0000-000000000003';

-- 5. Seed smart presets
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
