-- Migration: 005_trip_manual_route.sql
-- Adds from_location and to_location columns to the trips table
-- so drivers can persist manually entered route names that appear in the user app.

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS from_location TEXT,
  ADD COLUMN IF NOT EXISTS to_location   TEXT;

COMMENT ON COLUMN public.trips.from_location IS 'Driver-entered origin name (e.g. Kothanur)';
COMMENT ON COLUMN public.trips.to_location   IS 'Driver-entered destination name (e.g. Bangalore Airport)';
