// app/dashboard/components/DashboardHeader.js
// Note: View navigation is now in the sidebar (layout.js)
// This component is kept for backwards compatibility but no longer renders view tabs.
// The search button is passed directly to WorkOrdersView via onGlobalSearch prop.
'use client';

export default function DashboardHeader({ activeView, setActiveView, missingHoursCount = 0, onGlobalSearch }) {
  // Sidebar now handles all navigation - this component is a no-op
  return null;
}
