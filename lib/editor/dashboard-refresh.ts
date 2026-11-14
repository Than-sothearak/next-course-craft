const dashboardRefreshPendingKey = "coursecraft:dashboard-refresh-pending";

export function markDashboardRefreshPending() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(dashboardRefreshPendingKey, "true");
  } catch {
    // The editor save remains successful when browser storage is unavailable.
  }
}

export function consumeDashboardRefreshPending() {
  if (typeof window === "undefined") return false;
  try {
    const pending = window.sessionStorage.getItem(dashboardRefreshPendingKey) === "true";
    if (pending) window.sessionStorage.removeItem(dashboardRefreshPendingKey);
    return pending;
  } catch {
    return false;
  }
}
