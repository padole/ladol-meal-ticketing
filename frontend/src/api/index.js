// One function per Flask endpoint (backend/app/routes). Import from "../api".
import { del, get, patch, post, put, upload } from "./client";

// ---- Login, first-login password, session, change password ----
export const auth = {
  lookup: (employee_no) => post("/api/auth/lookup", { employee_no }), // { needs_password }
  login: (employee_no, password) => post("/api/auth/login", { employee_no, password }),
  setupPassword: (employee_no, surname, password) =>
    post("/api/auth/setup-password", { employee_no, surname, password }),
  logout: () => post("/api/auth/logout"),
  me: () => get("/api/auth/me"),
  changePassword: (current_password, new_password) =>
    post("/api/auth/change-password", { current_password, new_password }),
};

// ---- Account Management ----
export const companies = {
  list: () => get("/api/companies"),
  create: (c) => post("/api/companies", c),
};

export const staff = {
  list: (company) => get("/api/staff", { company }),
  create: (s) => post("/api/staff", s),
  purchases: (id) => get(`/api/staff/${id}/purchases`),
  breakdown: (id, params) => get(`/api/staff/${id}/breakdown`, params),
};

// ---- Menu + meal photos ----
export const meals = {
  list: (params) => get("/api/meals", params),
  get: (id) => get(`/api/meals/${id}`),
  staffMenu: (date) => get("/api/meals/staff-menu", { date }), // { meals: [≤3], served: [meal types] }
  create: (m) => post("/api/meals", m),
  update: (id, m) => put(`/api/meals/${id}`, m),
  remove: (id) => del(`/api/meals/${id}`),
  uploadImage: (id, file) => {
    const f = new FormData();
    f.append("image", file);
    return upload(`/api/meals/${id}/image`, f);
  },
  removeImage: (id) => del(`/api/meals/${id}/image`),
};

// ---- Ordering / serving at the counters, and own order history ----
const toItems = (cart) => cart.map((c) => ({ meal_id: c.id, quantity: c.q }));
export const orders = {
  employee: (employee_no, date) => get(`/api/orders/employee/${encodeURIComponent(employee_no.trim())}`, { date }), // counter lookup
  lookup: (number, date) => get(`/api/orders/lookup/${encodeURIComponent(number.trim())}`, { date }), // employee or contractor
  serveContractor: (customer_no, items, date) => post("/api/orders/contractor", { customer_no, items, date }), // items: [{meal_id, quantity}]
  serve: (employee_no, mealIds, date) =>
    post("/api/orders/staff", { employee_no, items: mealIds.map((meal_id) => ({ meal_id })), date }),
  mine: () => get("/api/orders/mine"), // logged-in user's 20 most recent orders
  history: (params) => get("/api/orders/mine/all", params), // all own orders: { orders, page, pages, summary }
  client: (cart, company, guests, date) => post("/api/orders/client", { items: toItems(cart), company, guests, date }),
};

// ---- Transactions, client requests, wallet, reports, staff roles, settings ----
export const transactions = {
  list: (params) => get("/api/transactions", params),
  remove: (id) => del(`/api/transactions/${id}`),
};

export const requests = {
  list: (status) => get("/api/requests", { status }),
  create: (r) => post("/api/requests", r),
  setStatus: (id, status) => patch(`/api/requests/${id}`, { status }),
};

export const wallet = {
  departments: () => get("/api/departments"),
  topups: (department) => get("/api/wallet/topups", { department }),
  fund: (t) => post("/api/wallet/topups", t),
  me: () => get("/api/wallet/me"), // { balance, history, monthly_limit }
  topUp: (amount) => post("/api/wallet/me/topup", { amount }), // added immediately -> { topup, balance }
};

export const reports = {
  summary: (days) => get("/api/reports/summary", { days }),
};

export const users = {
  list: (params) => get("/api/users", params), // Administrator only: { users, page, pages, total, roles, role_counts }
  setRole: (id, role) => patch(`/api/users/${id}/role`, { role }),
  resetPassword: (id) => post(`/api/users/${id}/reset-password`), // they create a new one at next login
};

export const settings = {
  get: () => get("/api/settings"),
  save: (s) => put("/api/settings", s),
};
