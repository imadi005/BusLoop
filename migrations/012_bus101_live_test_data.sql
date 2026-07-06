-- Keeps the Bus101 live-test route usable for passenger QR/live-bus testing.
-- This only normalizes seeded/test data; it does not change app behavior.

UPDATE public.routes
SET
  name = 'Kothanur to Airport Terminal',
  origin = 'Kothanur',
  destination = 'Airport Terminal',
  landmarks = 'Bagalur Cross, Airport Road',
  notes = 'Airport shuttle test route for Bus101',
  search_keywords = 'kothanur airport terminal bagalur airport road',
  base_fare = 30
WHERE id = '1d620dc9-72ba-46c3-a6f0-acdd12510f90';

UPDATE public.stops
SET
  name = 'Kothanur',
  lat = 13.06142,
  lng = 77.64931,
  stop_type = 'stop'
WHERE id = 'd797b2b3-64d7-48ca-ab56-8ac770bc87c0';

UPDATE public.stops
SET
  name = 'Airport Terminal',
  lat = 13.19864,
  lng = 77.70659,
  stop_type = 'stop'
WHERE id = 'bc6a3c02-dccd-476e-a437-e2c52619973f';

UPDATE public.buses
SET
  status = 'active',
  updated_at = NOW()
WHERE id = '900c2e86-629a-4697-a6e7-7a03458933e5';

UPDATE public.trips
SET
  status = 'active',
  from_location = 'Kothanur',
  to_location = 'Airport Terminal'
WHERE id = 'e4cec599-e48b-4ffd-a895-0337618a9d23';

INSERT INTO public.locations (trip_id, lat, lng, speed, heading, timestamp)
VALUES (
  'e4cec599-e48b-4ffd-a895-0337618a9d23',
  13.06142,
  77.64931,
  0,
  45,
  NOW()
);
