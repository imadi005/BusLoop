-- BusNOW production hardening: trusted fares, payment idempotency, staff status, and review rules.

ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS base_fare NUMERIC(10,2) NOT NULL DEFAULT 30 CHECK (base_fare >= 1);

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS is_terminated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS employee_id TEXT;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS tickets_razorpay_order_uidx
  ON public.tickets (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tickets_razorpay_payment_uidx
  ON public.tickets (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  passenger_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trip_id             UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  route_id            UUID NOT NULL REFERENCES public.routes(id) ON DELETE RESTRICT,
  from_stop_id        UUID NOT NULL REFERENCES public.stops(id) ON DELETE RESTRICT,
  to_stop_id          UUID NOT NULL REFERENCES public.stops(id) ON DELETE RESTRICT,
  amount              NUMERIC(10,2) NOT NULL CHECK (amount >= 1),
  amount_paise        INTEGER NOT NULL CHECK (amount_paise >= 100),
  currency            TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  razorpay_order_id   TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  ticket_id           UUID UNIQUE REFERENCES public.tickets(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed', 'cancelled')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at             TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Passengers view own payment orders" ON public.payment_orders;
CREATE POLICY "Passengers view own payment orders" ON public.payment_orders
  FOR SELECT USING (auth.uid() = passenger_id);

-- Keep staff privileges tied to active employment status.
DROP POLICY IF EXISTS "Staff can view own profile" ON public.staff;
DROP POLICY IF EXISTS "Operators manage staff" ON public.staff;
CREATE POLICY "Staff can view own active profile" ON public.staff
  FOR SELECT USING (auth.uid() = id AND is_terminated = FALSE);
CREATE POLICY "Operators manage active staff" ON public.staff
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid()
        AND role IN ('operator', 'super_admin')
        AND is_terminated = FALSE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid()
        AND role IN ('operator', 'super_admin')
        AND is_terminated = FALSE
    )
  );

DROP POLICY IF EXISTS "Operators manage routes" ON public.routes;
CREATE POLICY "Operators manage routes" ON public.routes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid()
        AND role IN ('operator', 'super_admin')
        AND is_terminated = FALSE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid()
        AND role IN ('operator', 'super_admin')
        AND is_terminated = FALSE
    )
  );

DROP POLICY IF EXISTS "Operators manage stops" ON public.stops;
CREATE POLICY "Operators manage stops" ON public.stops
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid()
        AND role IN ('operator', 'super_admin')
        AND is_terminated = FALSE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid()
        AND role IN ('operator', 'super_admin')
        AND is_terminated = FALSE
    )
  );

DROP POLICY IF EXISTS "Operators manage buses" ON public.buses;
CREATE POLICY "Operators manage buses" ON public.buses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid()
        AND role IN ('operator', 'super_admin')
        AND is_terminated = FALSE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid()
        AND role IN ('operator', 'super_admin')
        AND is_terminated = FALSE
    )
  );

DROP POLICY IF EXISTS "Drivers update bus status" ON public.buses;
CREATE POLICY "Drivers update assigned active bus status" ON public.buses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.trips
      JOIN public.staff ON staff.id = trips.driver_id
      WHERE trips.bus_id = buses.id
        AND trips.driver_id = auth.uid()
        AND trips.status = 'active'
        AND staff.role = 'driver'
        AND staff.is_terminated = FALSE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips
      JOIN public.staff ON staff.id = trips.driver_id
      WHERE trips.bus_id = buses.id
        AND trips.driver_id = auth.uid()
        AND trips.status = 'active'
        AND staff.role = 'driver'
        AND staff.is_terminated = FALSE
    )
  );

DROP POLICY IF EXISTS "Staff can manage own trips" ON public.trips;
CREATE POLICY "Staff can manage own trips" ON public.trips
  FOR ALL USING (
    auth.uid() = driver_id
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid()
        AND role = 'driver'
        AND is_terminated = FALSE
    )
  )
  WITH CHECK (
    auth.uid() = driver_id
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid()
        AND role = 'driver'
        AND is_terminated = FALSE
    )
  );

DROP POLICY IF EXISTS "Operators can manage all trips" ON public.trips;
CREATE POLICY "Operators can manage all trips" ON public.trips
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid()
        AND role IN ('operator', 'super_admin')
        AND is_terminated = FALSE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid()
        AND role IN ('operator', 'super_admin')
        AND is_terminated = FALSE
    )
  );

DROP POLICY IF EXISTS "Checkers can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Checkers can update ticket status" ON public.tickets;
CREATE POLICY "Active checkers can view tickets" ON public.tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid()
        AND role IN ('checker', 'operator', 'super_admin')
        AND is_terminated = FALSE
    )
  );
CREATE POLICY "Active checkers can update ticket status" ON public.tickets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid()
        AND role IN ('checker', 'operator', 'super_admin')
        AND is_terminated = FALSE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid()
        AND role IN ('checker', 'operator', 'super_admin')
        AND is_terminated = FALSE
    )
  );

DROP POLICY IF EXISTS "Passengers can insert own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Passengers insert reviews" ON public.reviews;
CREATE POLICY "Passengers can review buses they booked" ON public.reviews
  FOR INSERT WITH CHECK (
    auth.uid() = passenger_id
    AND EXISTS (
      SELECT 1 FROM public.tickets
      JOIN public.trips ON trips.id = tickets.trip_id
      WHERE tickets.passenger_id = auth.uid()
        AND trips.bus_id = reviews.bus_id
        AND tickets.status IN ('active', 'used')
    )
  );

DO $$
BEGIN
  IF to_regclass('public.operator_settings') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "authenticated can update" ON public.operator_settings';
    EXECUTE 'CREATE POLICY "Operators update settings" ON public.operator_settings
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.staff
          WHERE id = auth.uid()
            AND role IN (''operator'', ''super_admin'')
            AND is_terminated = FALSE
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.staff
          WHERE id = auth.uid()
            AND role IN (''operator'', ''super_admin'')
            AND is_terminated = FALSE
        )
      )';
  END IF;

  IF to_regclass('public.app_settings') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Operators manage app settings" ON public.app_settings';
    EXECUTE 'CREATE POLICY "Operators manage app settings" ON public.app_settings
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.staff
          WHERE id = auth.uid()
            AND role IN (''operator'', ''super_admin'')
            AND is_terminated = FALSE
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.staff
          WHERE id = auth.uid()
            AND role IN (''operator'', ''super_admin'')
            AND is_terminated = FALSE
        )
      )';
  END IF;
END $$;
