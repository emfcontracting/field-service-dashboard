// app/utils/navigation.js

export const routes = {
  // Main routes
  home: '/',
  dashboard: '/dashboard',
  mobile: '/mobile',
  
  // Dashboard sub-routes (if they exist as separate pages)
  invoices: '/invoices',
  users: '/users',
  settings: '/settings',
  
  // Authentication routes
  login: '/',  // Login is on landing page
  logout: '/api/auth/logout',
  
  // API routes
  api: {
    workOrders: '/api/workorders',
    invoices: '/api/invoices',
    availability: '/api/availability',
    users: '/api/users',
    auth: '/api/auth'
  }
};

// Navigation helper functions
export function navigateTo(route) {
  window.location.href = route;
}

export function navigateToDashboard() {
  window.location.href = routes.dashboard;
}

export function navigateToMobile() {
  window.location.href = routes.mobile;
}

export function navigateToInvoices() {
  window.location.href = routes.invoices;
}

export function navigateToUsers() {
  window.location.href = routes.users;
}

export function navigateToSettings() {
  window.location.href = routes.settings;
}

export function navigateToHome() {
  window.location.href = routes.home;
}