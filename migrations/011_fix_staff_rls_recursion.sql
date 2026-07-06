-- Fix staff RLS recursion by moving role checks into SECURITY DEFINER helpers.

CREATE OR REPLACE FUNCTION public.has_active_staff_role(required_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff
    WHERE id = auth.uid()
      AND role = ANY(required_roles)
      AND COALESCE(is_terminated, FALSE) = FALSE
  );
$$;

REVOKE ALL ON FUNCTION public.has_active_staff_role(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_staff_role(TEXT[]) TO anon, authenticated;

DROP POLICY IF EXISTS "Staff can view own active profile" ON public.staff;
DROP POLICY IF EXISTS "Operators manage active staff" ON public.staff;
DROP POLICY IF EXISTS "Staff can view own profile" ON public.staff;
DROP POLICY IF EXISTS "Operators manage staff" ON public.staff;

CREATE POLICY "Staff can view own active profile" ON public.staff
  FOR SELECT USING (auth.uid() = id AND COALESCE(is_terminated, FALSE) = FALSE);

CREATE POLICY "Operators manage active staff" ON public.staff
  FOR ALL USING (public.has_active_staff_role(ARRAY['operator', 'super_admin']))
  WITH CHECK (public.has_active_staff_role(ARRAY['operator', 'super_admin']));

DROP POLICY IF EXISTS "Operators manage routes" ON public.routes;
CREATE POLICY "Operators manage routes" ON public.routes
  FOR ALL USING (public.has_active_staff_role(ARRAY['operator', 'super_admin']))
  WITH CHECK (public.has_active_staff_role(ARRAY['operator', 'super_admin']));

DROP POLICY IF EXISTS "Operators manage stops" ON public.stops;
CREATE POLICY "Operators manage stops" ON public.stops
  FOR ALL USING (public.has_active_staff_role(ARRAY['operator', 'super_admin']))
  WITH CHECK (public.has_active_staff_role(ARRAY['operator', 'super_admin']));

DROP POLICY IF EXISTS "Operators manage buses" ON public.buses;
CREATE POLICY "Operators manage buses" ON public.buses
  FOR ALL USING (public.has_active_staff_role(ARRAY['operator', 'super_admin']))
  WITH CHECK (public.has_active_staff_role(ARRAY['operator', 'super_admin']));

DROP POLICY IF EXISTS "Drivers update assigned active bus status" ON public.buses;
DROP POLICY IF EXISTS "Drivers update bus status" ON public.buses;
CREATE POLICY "Drivers update assigned active bus status" ON public.buses
  FOR UPDATE USING (
    public.has_active_staff_role(ARRAY['driver'])
    AND EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.bus_id = buses.id
        AND trips.driver_id = auth.uid()
        AND trips.status = 'active'
    )
  )
  WITH CHECK (
    public.has_active_staff_role(ARRAY['driver'])
    AND EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.bus_id = buses.id
        AND trips.driver_id = auth.uid()
        AND trips.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Staff can manage own trips" ON public.trips;
CREATE POLICY "Staff can manage own trips" ON public.trips
  FOR ALL USING (auth.uid() = driver_id AND public.has_active_staff_role(ARRAY['driver']))
  WITH CHECK (auth.uid() = driver_id AND public.has_active_staff_role(ARRAY['driver']));

DROP POLICY IF EXISTS "Operators can manage all trips" ON public.trips;
CREATE POLICY "Operators can manage all trips" ON public.trips
  FOR ALL USING (public.has_active_staff_role(ARRAY['operator', 'super_admin']))
  WITH CHECK (public.has_active_staff_role(ARRAY['operator', 'super_admin']));

DROP POLICY IF EXISTS "Active checkers can view tickets" ON public.tickets;
DROP POLICY IF EXISTS "Active checkers can update ticket status" ON public.tickets;
DROP POLICY IF EXISTS "Checkers can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Checkers can update ticket status" ON public.tickets;

CREATE POLICY "Active checkers can view tickets" ON public.tickets
  FOR SELECT USING (public.has_active_staff_role(ARRAY['checker', 'operator', 'super_admin']));

CREATE POLICY "Active checkers can update ticket status" ON public.tickets
  FOR UPDATE USING (public.has_active_staff_role(ARRAY['checker', 'operator', 'super_admin']))
  WITH CHECK (public.has_active_staff_role(ARRAY['checker', 'operator', 'super_admin']));

DO $$
BEGIN
  IF to_regclass('public.operator_settings') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Operators update settings" ON public.operator_settings';
    EXECUTE 'CREATE POLICY "Operators update settings" ON public.operator_settings
      FOR UPDATE USING (public.has_active_staff_role(ARRAY[''operator'', ''super_admin'']))
      WITH CHECK (public.has_active_staff_role(ARRAY[''operator'', ''super_admin'']))';
  END IF;

  IF to_regclass('public.app_settings') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Operators manage app settings" ON public.app_settings';
    EXECUTE 'CREATE POLICY "Operators manage app settings" ON public.app_settings
      FOR ALL USING (public.has_active_staff_role(ARRAY[''operator'', ''super_admin'']))
      WITH CHECK (public.has_active_staff_role(ARRAY[''operator'', ''super_admin'']))';
  END IF;
END $$;
