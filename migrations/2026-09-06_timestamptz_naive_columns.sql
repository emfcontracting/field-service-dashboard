-- ============================================================================
-- 2026-09-06: timestamp WITHOUT time zone → timestamptz (naive UTC columns)
-- ----------------------------------------------------------------------------
-- These columns are `timestamp` (no zone) but have always been written with
-- toISOString() / now() in UTC — verified: 683 of 746 time_in values equal the
-- technician's "[9/3/2026, 10:11 AM] CHECKED IN" comment stamp to the minute
-- when read as UTC (the rest are re-check-ins). PostgREST returns them WITHOUT
-- a "Z", so every `new Date(...)` in the apps parsed them as local time: check-in
-- times 4–5 h late in the CBRE form, response-time KPIs padded, offline-sync
-- conflict resolution biased. Converting them to timestamptz (interpreting the
-- stored values as UTC — no value changes) makes the API return "+00:00" and
-- every parser, old or new, gets the right instant.
--
--   work_orders.time_in, time_out, assigned_to_field_at, created_at, updated_at
--   users.created_at, updated_at
--   work_order_assignments.created_at
--
-- Views depending on these columns (e.g. cbre_acknowledgement_queue) block
-- ALTER TYPE, so the block below saves their definitions, options and grants,
-- drops them, alters the columns and recreates them unchanged.
-- Re-runnable (already-converted columns are skipped). Run BEFORE or AFTER
-- deploying the matching build — the code handles both shapes.
-- ============================================================================

do $$
declare
  targets constant text[] := array[
    'work_orders.time_in', 'work_orders.time_out', 'work_orders.assigned_to_field_at',
    'work_orders.created_at', 'work_orders.updated_at',
    'users.created_at', 'users.updated_at',
    'work_order_assignments.created_at'
  ];
  t text; tbl text; col text; typ text;
  v record; g record;
  pending int; pass int; n_views_before int; n_views_after int;
begin
  select count(*) into n_views_before from pg_views where schemaname = 'public';
  -- 1) collect every view that depends (directly or through another view) on
  --    one of the target columns.
  create temp table _tz_views (
    oid oid primary key, vname text, def text, opts text[], grants text[]
  ) on commit drop;

  with recursive cols as (
    select a.attrelid, a.attnum
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and (c.relname || '.' || a.attname) = any (targets)
      and not a.attisdropped
  ),
  dep as (
    select distinct r.ev_class as vid
    from pg_depend d
    join pg_rewrite r on r.oid = d.objid and d.classid = 'pg_rewrite'::regclass
    join cols on cols.attrelid = d.refobjid and (d.refobjsubid = cols.attnum or d.refobjsubid = 0)
    where d.refclassid = 'pg_class'::regclass
      and r.ev_class <> d.refobjid
    union
    select r.ev_class
    from dep
    join pg_depend d on d.refobjid = dep.vid and d.refclassid = 'pg_class'::regclass
    join pg_rewrite r on r.oid = d.objid and d.classid = 'pg_rewrite'::regclass
    where r.ev_class <> dep.vid
  )
  insert into _tz_views (oid, vname, def, opts, grants)
  select c.oid,
         format('%I.%I', n.nspname, c.relname),
         pg_get_viewdef(c.oid, true),
         c.reloptions,
         (select array_agg(format('grant %s on %I.%I to %s', privilege_type, n.nspname, c.relname,
                                  case when grantee = 'PUBLIC' then 'public' else quote_ident(grantee) end))
            from information_schema.role_table_grants
           where table_schema = n.nspname and table_name = c.relname)
  from dep
  join pg_class c on c.oid = dep.vid and c.relkind = 'v'
  join pg_namespace n on n.oid = c.relnamespace;

  -- CASCADE only ever reaches views that are in _tz_views as well (the
  -- recursive query above followed view-on-view dependencies); the count check
  -- at the end proves nothing else was taken along.
  for v in select * from _tz_views loop
    raise notice 'dropping dependent view %', v.vname;
    execute format('drop view if exists %s cascade', v.vname);
  end loop;

  -- 2) alter the columns (only the ones still without time zone).
  foreach t in array targets loop
    tbl := split_part(t, '.', 1);
    col := split_part(t, '.', 2);
    select data_type into typ
      from information_schema.columns
     where table_schema = 'public' and table_name = tbl and column_name = col;
    if typ is null then
      raise notice 'skip %.% (column not found)', tbl, col;
    elsif typ = 'timestamp without time zone' then
      execute format('alter table public.%I alter column %I type timestamptz using %I at time zone ''UTC''', tbl, col, col);
      raise notice 'converted %.%', tbl, col;
    else
      raise notice 'skip %.% (already %)', tbl, col, typ;
    end if;
  end loop;

  -- created_at / updated_at defaults: make sure they are plain now() (timestamptz)
  -- rather than a leftover timezone('utc', now()) cast.
  for t in select unnest(targets) loop
    tbl := split_part(t, '.', 1);
    col := split_part(t, '.', 2);
    if col in ('created_at', 'updated_at') then
      execute format('alter table public.%I alter column %I set default now()', tbl, col);
    end if;
  end loop;

  -- 3) recreate the views (retry passes handle view-on-view ordering).
  pending := (select count(*) from _tz_views);
  pass := 0;
  while pending > 0 and pass < 10 loop
    pass := pass + 1;
    for v in select * from _tz_views loop
      begin
        execute format('create view %s as %s', v.vname, v.def);
        if v.opts is not null then
          execute format('alter view %s set (%s)', v.vname, array_to_string(v.opts, ', '));
        end if;
        if v.grants is not null then
          foreach t in array v.grants loop execute t; end loop;
        end if;
        delete from _tz_views where oid = v.oid;
        raise notice 'recreated view %', v.vname;
      exception when others then
        raise notice 'view % not yet recreatable (%): retrying', v.vname, sqlerrm;
      end;
    end loop;
    pending := (select count(*) from _tz_views);
  end loop;
  if pending > 0 then
    raise exception 'could not recreate % dependent view(s) — see notices', pending;
  end if;
  select count(*) into n_views_after from pg_views where schemaname = 'public';
  if n_views_after <> n_views_before then
    raise exception 'view count changed (% → %) — aborting, nothing is committed', n_views_before, n_views_after;
  end if;
  raise notice 'done — view count unchanged (%)', n_views_after;
end $$;

notify pgrst, 'reload schema';

-- Check: every target should now say "timestamp with time zone".
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('work_orders','time_in'), ('work_orders','time_out'), ('work_orders','assigned_to_field_at'),
    ('work_orders','created_at'), ('work_orders','updated_at'),
    ('users','created_at'), ('users','updated_at'),
    ('work_order_assignments','created_at'))
order by 1, 2;
