-- Security guardrails for production workflows.
-- Adds DB-level protection against profile role escalation, broad ticket edits,
-- oversized review payloads, and stale staff-role checks.

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Passengers update own safe profile" ON public.users;

CREATE POLICY "Passengers update own safe profile" ON public.users
  FOR UPDATE
  USING (auth.uid() = id AND role = 'passenger')
  WITH CHECK (auth.uid() = id AND role = 'passenger');

CREATE OR REPLACE FUNCTION public.prevent_user_profile_privilege_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Profile id cannot be changed';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Profile email cannot be changed here';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Profile role cannot be changed';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Profile created_at cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_user_profile_privilege_update ON public.users;
CREATE TRIGGER prevent_user_profile_privilege_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_profile_privilege_update();

CREATE OR REPLACE FUNCTION public.prevent_unsafe_ticket_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_payload JSONB;
  new_payload JSONB;
  is_operator BOOLEAN;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  old_payload := to_jsonb(OLD) - 'status' - 'used_at';
  new_payload := to_jsonb(NEW) - 'status' - 'used_at';

  IF new_payload IS DISTINCT FROM old_payload THEN
    RAISE EXCEPTION 'Only ticket status verification fields can be updated';
  END IF;

  is_operator := public.has_active_staff_role(ARRAY['operator', 'super_admin']);

  IF NOT is_operator THEN
    IF OLD.status IS DISTINCT FROM 'active' OR NEW.status IS DISTINCT FROM 'used' THEN
      RAISE EXCEPTION 'Checkers can only mark active tickets as used';
    END IF;
  ELSE
    IF NEW.status NOT IN ('active', 'used', 'expired', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid ticket status';
    END IF;
  END IF;

  IF NEW.status = 'used' AND NEW.used_at IS NULL THEN
    NEW.used_at := NOW();
  END IF;

  IF NEW.status IS DISTINCT FROM 'used' AND NEW.used_at IS DISTINCT FROM OLD.used_at THEN
    RAISE EXCEPTION 'used_at can only change when marking a ticket used';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_unsafe_ticket_update ON public.tickets;
CREATE TRIGGER prevent_unsafe_ticket_update
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unsafe_ticket_update();

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_comment_length_chk;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_comment_length_chk
  CHECK (
    comment IS NULL
    OR char_length(btrim(comment)) BETWEEN 1 AND 500
  ) NOT VALID;

DO $$
BEGIN
  IF to_regclass('public.route_presets') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Operators manage presets" ON public.route_presets';
    EXECUTE 'CREATE POLICY "Operators manage presets" ON public.route_presets
      FOR ALL USING (public.has_active_staff_role(ARRAY[''operator'', ''super_admin'']))
      WITH CHECK (public.has_active_staff_role(ARRAY[''operator'', ''super_admin'']))';
  END IF;
END $$;
