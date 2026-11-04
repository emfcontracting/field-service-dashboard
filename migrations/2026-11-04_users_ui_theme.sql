-- 2026-11-04 · Dashboard themes
-- ---------------------------------------------------------------------------
-- The office dashboard can now be viewed in more than one layout. Which one a
-- person sees is their own choice and follows them to every device, so it
-- lives on the users row, not in the browser.
--
--   classic  the Obsidian dashboard as it has always been (default)
--   today    the "Today" layout: action list, pipeline, cockpit
--
-- No CHECK constraint on purpose: new themes are added in lib/uiThemes.js, and
-- an unknown value there simply falls back to classic. Only admins can switch
-- while the new layout is still growing; everyone else sees classic no matter
-- what the column says (enforced in the app).
-- ---------------------------------------------------------------------------

alter table public.users
  add column if not exists ui_theme text not null default 'classic';

comment on column public.users.ui_theme is
  'Dashboard layout for this user: classic (default) or today. Registry: lib/uiThemes.js';
