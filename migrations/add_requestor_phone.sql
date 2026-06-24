-- migrations/add_requestor_phone.sql
-- Adds a dedicated requestor_phone column to work_orders.
--
-- Why: the requestor's phone was previously parsed from CBRE emails but only
-- dropped into the comments text ("Contact Phone: ..."). It now lives in its
-- own column so it can be entered separately in the manual New Work Order form
-- and shown next to the requestor name. CBRE escalation contacts (Dispatcher,
-- Conveyors, Environmental, Capital, GTSG, ...) continue to go into comments
-- as a formatted "CBRE Contacts" block.
--
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS requestor_phone text;
