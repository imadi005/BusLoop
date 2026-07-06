-- ================================================================
-- BusNOW Migration 004 — Operator UPI / Payment Settings
-- Run this in Supabase Dashboard → SQL Editor
-- ================================================================

-- Single-row settings table for the operator
CREATE TABLE IF NOT EXISTS operator_settings (
  id          SERIAL PRIMARY KEY,
  upi_id      TEXT,          -- e.g. operator@ybl  or  9876543210@paytm
  upi_name    TEXT,          -- display name shown on payment app  e.g. "BusNOW Travels"
  fare_note   TEXT,          -- optional note shown to user before payment
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed one row so we can always UPDATE instead of INSERT
INSERT INTO operator_settings (id, upi_id, upi_name)
VALUES (1, '', 'BusNOW Operator')
ON CONFLICT (id) DO NOTHING;

-- Allow public read (users need the UPI ID to pay)
ALTER TABLE operator_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read settings"  ON operator_settings FOR SELECT USING (true);
CREATE POLICY "authenticated can update"  ON operator_settings FOR UPDATE USING (auth.role() = 'authenticated');
