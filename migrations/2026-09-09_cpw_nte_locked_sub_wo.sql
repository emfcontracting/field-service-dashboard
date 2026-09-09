-- ============================================================================
-- 2026-09-09: CPW work orders whose NTE can no longer be raised → sub work order
-- ----------------------------------------------------------------------------
-- CBRE freezes the NTE when it posts a work order. From CPW ("order closed,
-- waiting paperwork") onwards the portal accepts no further increase — the
-- vendor form still takes the submission and mails a confirmation back, so the
-- request looks like it went through and is then never acted on. That is why
-- C2965174 has been waiting since January 2026.
--
-- Everything we earned above the posted NTE can therefore only be billed on a
-- NEW work order CBRE issues for it, exactly like groups A/B/C.
--
-- Which work orders are in here: cbre_posting_status = 'CPW', our billable
-- amount above the NTE CBRE actually has, and NO quote approved in the portal.
-- A quote marked 'verbal_approved' does NOT count — a verbal approval is worth
-- something for our own tracking but was never entered as a number at CBRE.
-- The 11 CPW work orders with an 'approved' quote are deliberately NOT here:
-- their NTE was raised for real and they are billed normally.
--
-- Official NTE per work order = cbre_nte where known, otherwise the
-- original_nte recorded on the first quote (work_orders.nte is unreliable, it
-- carries the verbal approvals).
--
-- >>> Block 1 goes on the day mail 4 is sent. Block 2 waits for the UPS
--     routing answer (CBRE rejected group C as "conveyor related — contact
--     UPS"), so it is commented out. <<<
-- Re-runnable.
-- ============================================================================

-- ============================================================================
-- Block 1 — mail 4 to Adriana Davis: 8 non-conveyor work orders, $15,827.51
-- ============================================================================
with amt(wo_number, billable) as (values
  ('C2876507', 4695.15), ('C2891401', 3990.21), ('C2947395',  672.00),
  ('C2959782', 1493.00), ('C2967150', 1121.15), ('C2968992',  926.00),
  ('C3064316', 1150.00), ('C3162451', 1780.00))
update public.work_orders w
   set dispute_status       = 'sub_wo_requested',
       dispute_reason       = 'nte_locked_posted',
       dispute_requested_at = coalesce(w.dispute_requested_at, now()),
       dispute_amount       = a.billable,
       dispute_notes        = concat_ws(E'\n', nullif(btrim(w.dispute_notes), ''),
         to_char(now(), 'FMMM/FMDD/YYYY') || ' — Posted at CBRE (CPW) before the NTE was raised; the portal takes no further increase. Sub-WO requested from Adriana Davis (e-mail 4, 8 non-conveyor WOs, $15,827.51). Billable: $' || to_char(a.billable, 'FM999,999.00'))
  from amt a
 where w.wo_number = a.wo_number
   and w.dispute_status is distinct from 'resolved'
   -- keeps a second run from appending the note again
   and coalesce(w.dispute_notes, '') not like '%Posted at CBRE (CPW) before the NTE was raised%';

select 'block 1' as block, wo_number, dispute_status, dispute_reason, dispute_amount
  from public.work_orders
 where wo_number in ('C2876507','C2891401','C2947395','C2959782','C2967150','C2968992','C3064316','C3162451')
 order by wo_number;

-- ============================================================================
-- Block 2 — the 14 conveyor work orders, $37,355.00. CBRE turned group C down
-- with "These are all conveyor related issues. You will need to contact UPS for
-- resolution." Do NOT send these to Adriana until that routing is settled.
-- Uncomment on the day they go out to whoever turns out to be responsible.
-- ============================================================================
-- with amt(wo_number, billable) as (values
--   ('C2965174', 2942.00), ('C3115553', 1604.00), ('C3139911', 1905.00), ('C3146646', 2487.50),
--   ('C3147627', 2064.00), ('C3166052', 3400.00), ('C3171690', 2228.50), ('C3226615', 3496.00),
--   ('C3231176', 2083.00), ('C3240232', 4218.50), ('C3266289', 3566.00), ('C3270457', 2748.00),
--   ('C3272625', 1817.50), ('C3274548', 2795.00))
-- update public.work_orders w
--    set dispute_status       = 'sub_wo_requested',
--        dispute_reason       = 'nte_locked_posted',
--        dispute_requested_at = coalesce(w.dispute_requested_at, now()),
--        dispute_amount       = a.billable,
--        dispute_notes        = concat_ws(E'\n', nullif(btrim(w.dispute_notes), ''),
--          to_char(now(), 'FMMM/FMDD/YYYY') || ' — Posted at CBRE (CPW) before the NTE was raised. Conveyor work — routed per CBRE to UPS. Billable: $' || to_char(a.billable, 'FM999,999.00'))
--   from amt a
--  where w.wo_number = a.wo_number
--    and w.dispute_status is distinct from 'resolved'
--    and coalesce(w.dispute_notes, '') not like '%Posted at CBRE (CPW) before the NTE was raised%';
