-- Enforce two-hour ticket boarding validity.
-- Passengers must board within 2 hours of booked_at; after that an active ticket is expired.

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

  IF NEW.status = 'used' THEN
    IF OLD.booked_at < NOW() - INTERVAL '2 hours' THEN
      RAISE EXCEPTION 'Ticket expired. Passenger must board within 2 hours of booking';
    END IF;

    IF NEW.used_at IS NULL THEN
      NEW.used_at := NOW();
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM 'used' AND NEW.used_at IS DISTINCT FROM OLD.used_at THEN
    RAISE EXCEPTION 'used_at can only change when marking a ticket used';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_active_tickets()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.tickets
  SET status = 'expired'
  WHERE status = 'active'
    AND booked_at < NOW() - INTERVAL '2 hours';

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;
