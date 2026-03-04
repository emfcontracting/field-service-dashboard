// app/dashboard/layout.js
'use client';

import AppShell from '@/app/components/AppShell';

export default function DashboardLayout({ children }) {
  return (
    <AppShell>
      {children}
    </AppShell>
  );
}
