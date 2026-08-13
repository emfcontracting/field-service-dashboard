-- migrations/migrate_priority_buckets_to_pcodes.sql
-- One-time: map legacy priority BUCKETS to canonical P-codes so the new P-code
-- priority filter/dropdowns work on existing tickets.
-- Mapping (adjust BEFORE running): Emergency->P1, High->P2, Medium->P4, Low->P5.
-- Safe to re-run; only touches rows still holding a bucket.

UPDATE work_orders SET priority = 'P1' WHERE lower(trim(priority)) = 'emergency';
UPDATE work_orders SET priority = 'P2' WHERE lower(trim(priority)) IN ('high', 'urgent');
UPDATE work_orders SET priority = 'P4' WHERE lower(trim(priority)) IN ('medium', 'normal');
UPDATE work_orders SET priority = 'P5' WHERE lower(trim(priority)) = 'low';

-- Leftovers that are NOT clean P-codes:
--   SELECT DISTINCT priority, count(*) FROM work_orders
--   WHERE priority IS NOT NULL AND priority !~ '^P[0-9]+$'
--   GROUP BY priority ORDER BY count DESC;
