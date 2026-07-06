-- Prevent duplicate passenger reviews for the same journey.
-- Keeps the earliest existing duplicate before adding unique indexes.

WITH ranked_trip_reviews AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY passenger_id, trip_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.reviews
  WHERE trip_id IS NOT NULL
)
DELETE FROM public.reviews
WHERE id IN (
  SELECT id FROM ranked_trip_reviews WHERE rn > 1
);

WITH ranked_bus_fallback_reviews AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY passenger_id, bus_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.reviews
  WHERE trip_id IS NULL
)
DELETE FROM public.reviews
WHERE id IN (
  SELECT id FROM ranked_bus_fallback_reviews WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_passenger_trip_uidx
  ON public.reviews (passenger_id, trip_id)
  WHERE trip_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reviews_passenger_bus_fallback_uidx
  ON public.reviews (passenger_id, bus_id)
  WHERE trip_id IS NULL;
