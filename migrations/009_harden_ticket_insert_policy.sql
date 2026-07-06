-- Tickets must be created only after server-side payment verification.
-- Passengers can still read their own tickets, but cannot insert tickets directly.
DROP POLICY IF EXISTS "Passengers can insert own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Passengers insert own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Passengers can book tickets" ON public.tickets;
DROP POLICY IF EXISTS "Passengers insert tickets" ON public.tickets;
