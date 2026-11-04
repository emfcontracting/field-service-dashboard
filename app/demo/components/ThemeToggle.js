// app/demo/components/ThemeToggle.js
'use client';

// Light / dark switch for the demo pages. The choice is written as
// data-pcs-theme on <html> (demo-tokens.css reads it) and remembered per
// browser. Until someone picks, the system setting decides.
import { useEffect, useState } from 'react';

const KEY = 'pcs-demo-theme';

function systemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function storedTheme() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    const t = storedTheme() || systemTheme();
    if (storedTheme()) document.documentElement.dataset.pcsTheme = t;
    setTheme(t);
  }, []);

  const choose = (t) => {
    document.documentElement.dataset.pcsTheme = t;
    try { localStorage.setItem(KEY, t); } catch { /* storage unavailable */ }
    setTheme(t);
  };

  return (
    <span className={`lp-theme-toggle ${className}`} role="group" aria-label="Colour theme">
      <button type="button" aria-pressed={theme === 'light'} onClick={() => choose('light')}>Light</button>
      <button type="button" aria-pressed={theme === 'dark'} onClick={() => choose('dark')}>Dark</button>
    </span>
  );
}
