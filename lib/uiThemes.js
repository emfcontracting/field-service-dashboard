// lib/uiThemes.js
// ─────────────────────────────────────────────────────────────────────────────
// The dashboard layouts a person can choose between — Settings → Appearance.
//
// A theme here is more than a colour scheme: it decides which shell wraps the
// office pages (sidebar, header) and which view opens as the home screen. The
// classic Obsidian dashboard stays exactly as it is; a theme is a different
// front door to the same processes, never a replacement for any of them.
//
// Adding a theme: one entry below, a shell branch in app/components/AppShell.js,
// and whatever views it brings in app/dashboard/page.js. The users.ui_theme
// column stores the key as plain text — an unknown key falls back to classic.
//
// WHO MAY SWITCH: while a theme is `adminOnly`, non-admins see classic no
// matter what their row says. Flip the flag when the layout is ready for
// everyone; nothing else has to change.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_UI_THEME = 'classic';

export const UI_THEMES = {
  classic: {
    key: 'classic',
    label: 'Classic',
    tagline: 'The Obsidian dashboard as it has always been.',
    description: 'Work Orders first, every process in its own tab. Nothing moves.',
    homeView: 'workorders',
    adminOnly: false,
    swatch: ['#0a0a0f', '#0d0d14', '#2563eb', '#94a3b8'],
  },
  today: {
    key: 'today',
    label: 'Today',
    tagline: 'What has to happen today — and who has to do it.',
    description: 'A home screen built from the action list, the money strip, a one-row pipeline and the crew in the field. Pipeline board and Sites & Crew cockpit as the second and third tab. Every classic tab stays reachable under All tools.',
    homeView: 'today',
    adminOnly: true,
    swatch: ['#0b0d12', '#141822', '#3b82f6', '#fbbf24'],
  },
};

export const UI_THEME_KEYS = Object.keys(UI_THEMES);

/**
 * The theme a user actually gets: their stored choice, if it exists and they
 * are allowed to have it; classic otherwise.
 */
export function resolveUiTheme(user) {
  const key = String(user?.ui_theme || '').trim();
  const theme = UI_THEMES[key];
  if (!theme) return DEFAULT_UI_THEME;
  if (theme.adminOnly && user?.role !== 'admin') return DEFAULT_UI_THEME;
  return theme.key;
}

/** Themes this user may pick from in Settings. */
export function selectableUiThemes(user) {
  return Object.values(UI_THEMES).filter((t) => !t.adminOnly || user?.role === 'admin');
}

/** The view a theme opens on when /dashboard is called without ?view=. */
export function homeViewFor(themeKey) {
  return UI_THEMES[themeKey]?.homeView || UI_THEMES[DEFAULT_UI_THEME].homeView;
}
