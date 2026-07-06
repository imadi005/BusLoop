-- ================================================================
-- BusNOW Migration 003 — Staff termination, bus photo, collection
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ================================================================

-- 1. Staff: add termination flag, phone number, employee ID
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_terminated BOOLEAN DEFAULT FALSE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone         TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS employee_id   TEXT;

-- 2. Buses: optional photo URL and destination label
ALTER TABLE buses ADD COLUMN IF NOT EXISTS photo_url    TEXT;
ALTER TABLE buses ADD COLUMN IF NOT EXISTS destination  TEXT;

-- 3. Tickets: ticket price / fare amount for collection reporting
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2) DEFAULT 0;

-- Done ✓
