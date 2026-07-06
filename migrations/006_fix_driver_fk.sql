-- Migration: 006_fix_driver_fk.sql
-- Problem: trips.driver_id had a FK constraint to public.users, but drivers are
--          stored in the public.staff table (not public.users). This caused every
--          trip INSERT from the driver dashboard to fail with a FK violation, which
--          was silently caught and fell back to "demo" mode. As a result, no real
--          trip row was ever written to the DB, so the user map showed nothing.
-- Fix: Drop the broken FK and re-add it pointing at public.staff.
--      Also fix the RLS policies on trips and locations to use public.staff.

-- ────────────────────────────────────────────────────────
-- 1. Fix trips.driver_id foreign key
-- ────────────────────────────────────────────────────────

-- Drop the old (wrong) FK
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_driver_id_fkey;

-- Add the correct FK pointing at public.staff
ALTER TABLE public.trips
  ADD CONSTRAINT trips_driver_id_fkey
  FOREIGN KEY (driver_id) REFERENCES public.staff(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────
-- 2. Fix RLS policies on public.trips
-- ────────────────────────────────────────────────────────

-- Drop old policies that may reference the wrong table
DROP POLICY IF EXISTS "Drivers can manage own trips"     ON public.trips;
DROP POLICY IF EXISTS "Operators can view all trips"     ON public.trips;
DROP POLICY IF EXISTS "Anyone can view active trips"     ON public.trips;

-- Anyone (including unauthenticated) can see active trips (needed for user map)
CREATE POLICY "Anyone can view active trips" ON public.trips
  FOR SELECT USING (status = 'active');

-- Staff (drivers, checkers) can view and manage their own trips
CREATE POLICY "Staff can manage own trips" ON public.trips
  FOR ALL USING (auth.uid() = driver_id);

-- Operators can manage all trips
CREATE POLICY "Operators can manage all trips" ON public.trips
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid() AND role IN ('operator', 'super_admin')
    )
  );

-- ────────────────────────────────────────────────────────
-- 3. Fix RLS policies on public.locations
-- ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Drivers can insert own trip locations" ON public.locations;
DROP POLICY IF EXISTS "Staff can insert trip locations"       ON public.locations;

-- Any authenticated staff member can insert locations for a trip they are driving
CREATE POLICY "Staff can insert trip locations" ON public.locations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id AND driver_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────
-- 4. Ensure Realtime is enabled for all required tables
-- ────────────────────────────────────────────────────────

-- These may already exist; DO NOTHING if so
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.buses;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END;
$$;
