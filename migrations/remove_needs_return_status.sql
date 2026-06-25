-- remove_needs_return_status.sql
-- ----------------------------------------------------------------------------
-- Retire the legacy 'needs_return' work-order status.
--
-- 'tech_review' (office / invoicing return) is now the SINGLE canonical
-- "returned for review" status. 'return_trip' (the tech's own physical return
-- trip to the facility) is a DIFFERENT status and is intentionally left alone.
--
-- This converts any work orders still sitting on 'needs_return' to 'tech_review'
-- so nothing is left orphaned after needs_return is removed from the UI.
-- Safe to run repeatedly; zero rows match once migrated.
-- ----------------------------------------------------------------------------

UPDATE work_orders
SET    status = 'tech_review'
WHERE  status = 'needs_return';

-- Optional sanity check (run separately if you want a count first):
-- SELECT count(*) AS still_needs_return FROM work_orders WHERE status = 'needs_return';
