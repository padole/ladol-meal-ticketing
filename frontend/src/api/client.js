// Low-level HTTP helpers. Every call goes to the Flask API (proxied by Vite in development),
// sends the session cookie, and turns {"error": "..."} responses into thrown Errors.

// ---- Config ----
export const API_BASE_URL = import.meta.env.VITE_API_URL || "";

// Fired when the server says the session is gone; App listens and sends the user to Login.
export const AUTH_EXPIRED = "auth:expired";

// ---- Query string builder (skips empty values) ----
const qs = (params) => {
  const p = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return p.length ? "?" + new URLSearchParams(p) : "";
};

// ---- JSON request: used by get/post/put/patch/del below ----
export async function request(path, { params, body, ...options } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}${qs(params)}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/api/auth/")) window.dispatchEvent(new Event(AUTH_EXPIRED));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// multipart upload (e.g. images): let the browser set the Content-Type with the form boundary
export async function upload(path, formData) {
  const res = await fetch(`${API_BASE_URL}${path}`, { method: "POST", credentials: "include", body: formData });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) window.dispatchEvent(new Event(AUTH_EXPIRED));
  if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
  return data;
}

// ---- Shorthand helpers ----
export const get = (path, params) => request(path, { params });
export const post = (path, body) => request(path, { method: "POST", body });
export const put = (path, body) => request(path, { method: "PUT", body });
export const patch = (path, body) => request(path, { method: "PATCH", body });
export const del = (path) => request(path, { method: "DELETE" });
