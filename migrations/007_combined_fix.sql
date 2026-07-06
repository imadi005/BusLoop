-- ============================================================
-- BusNOW — Combined Fix Migration
-- File: 007_combined_fix.sql
-- Run this ONCE in: Supabase Dashboard → SQL Editor → Run
--
-- This migration:
--   1. Adds from_location / to_location to trips (was migration 005)
--   2. Fixes trips.driver_id FK — was pointing at public.users instead of
--      public.staff, causing every driver trip INSERT to fail silently
--   3. Fixes RLS policies on trips + locations so drivers can insert
--   4. Ensures Realtime is enabled on all live-tracking tables
-- ============================================================

-- ────────────────────────────────────────────────────────────────
-- PART 1: Add from_location / to_location to trips (migration 005)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS from_location TEXT,
  ADD COLUMN IF NOT EXISTS to_location   TEXT;

COMMENT ON COLUMN public.trips.from_location IS 'Driver-entered origin name (e.g. Kothanur)';
COMMENT ON COLUMN public.trips.to_location   IS 'Driver-entered destination name (e.g. Bangalore Airport)';

-- ────────────────────────────────────────────────────────────────
-- PART 2: Fix trips.driver_id foreign key (migration 006)
-- ────────────────────────────────────────────────────────────────

-- Drop the wrong FK (pointed at public.users — drivers are in public.staff)
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_driver_id_fkey;

-- Make driver_id nullable (staff FK — if staff row deleted, don't cascade delete trip)
ALTER TABLE public.trips ALTER COLUMN driver_id DROP NOT NULL;

-- Add correct FK pointing at public.staff
ALTER TABLE public.trips
  ADD CONSTRAINT trips_driver_id_fkey
  FOREIGN KEY (driver_id) REFERENCES public.staff(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────────
-- PART 3: Fix RLS policies on public.trips
-- ────────────────────────────────────────────────────────────────

-- Remove all old trip policies (some reference wrong tables)
DROP POLICY IF EXISTS "Drivers can manage own trips"  ON public.trips;
DROP POLICY IF EXISTS "Operators can view all trips"  ON public.trips;
DROP POLICY IF EXISTS "Anyone can view active trips"  ON public.trips;
DROP POLICY IF EXISTS "Staff can manage own trips"    ON public.trips;
DROP POLICY IF EXISTS "Operators can manage all trips" ON public.trips;

-- Anyone (including unauthenticated passengers) can see active trips
CREATE POLICY "Anyone can view active trips" ON public.trips
  FOR SELECT USING (status = 'active');

-- Staff (drivers) can view and manage trips they are driving
CREATE POLICY "Staff can manage own trips" ON public.trips
  FOR ALL USING (auth.uid() = driver_id);

-- Operators / super-admins can manage all trips
CREATE POLICY "Operators can manage all trips" ON public.trips
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid() AND role IN ('operator', 'super_admin')
    )
  );

-- ────────────────────────────────────────────────────────────────
-- PART 4: Fix RLS policies on public.locations
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Drivers can insert own trip locations" ON public.locations;
DROP POLICY IF EXISTS "Staff can insert trip locations"       ON public.locations;

-- Staff can push GPS pings for their own active trip
CREATE POLICY "Staff can insert trip locations" ON public.locations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id AND driver_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────
-- PART 5: Ensure Realtime publication covers all live-tracking tables
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
