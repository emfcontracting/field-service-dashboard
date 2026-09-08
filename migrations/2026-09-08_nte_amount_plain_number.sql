-- ============================================================================
-- 2026-09-08: NTE Request Amount in queued CBRE forms → plain number
-- ----------------------------------------------------------------------------
-- CBRE's "NTE Request Amount" is a NUMERIC field. buildCbrePayload formatted
-- the amount with a thousands separator ("2,335.00"), so the prefilled form
-- showed the number but would not accept it. The code now sends moneyPlain()
-- ("2335.00"); this fixes the rows already queued.
-- Only live requests (pending / approved / sent) are touched — rejected ones
-- are history. The display mirror payload->_readable keeps the pretty format.
-- Re-runnable.
-- ============================================================================

update public.approval_requests
   set payload = jsonb_set(payload, '{5wAdLAyzm}', to_jsonb(replace(payload->>'5wAdLAyzm', ',', '')))
 where kind = 'cbre_nte'
   and status <> 'rejected'
   and payload->>'5wAdLAyzm' like '%,%';

-- Check: no live NTE request may carry a comma any more.
select wo_number, status, payload->>'5wAdLAyzm' as nte_amount
  from public.approval_requests
 where kind = 'cbre_nte' and status <> 'rejected'
 order by created_at desc;
