// ---- Who can open what ----
// pages ordinary staff (role Employee) may open; everything else is for admins.
// The Flask API enforces the same rule, this just keeps the UI tidy.
export const STAFF_PAGES = ["home", "login", "pos", "profile", "myorders"];

// where each kind of user lands after login (and when they open a page they can't use)
export const homeFor = (user) => (user?.is_admin ? "dash" : "profile");

// ---- URL table ----
// page key (used by go("key") across the app) -> URL path
export const ROUTES = {
  home: "/",
  login: "/login",
  dash: "/dashboard",
  companies: "/companies",
  staff: "/staff",
  purchases: "/purchases",
  breakdown: "/breakdown",
  tx: "/transactions",
  menu: "/menu",
  add: "/add-meal",
  client: "/client-dining",
  pos: "/staff-dining",
  wallet: "/wallet",
  report: "/reports",
  settings: "/settings",
  profile: "/profile",
  myorders: "/my-orders",
};
