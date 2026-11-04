import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppRouter from "./router/AppRouter";
import { ROUTES } from "./router/routes";
import { auth } from "./api";
import { AUTH_EXPIRED } from "./api/client";

// Root component: holds the logged-in user, the toast message, and the go() navigation helper.
// Everything is passed down to every page through `ctx`.
export default function App() {
  // ---- State ----
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [msg, setMsg] = useState("");

  // ---- Session: on load ask Flask who is logged in; log out locally if the API reports 401 ----
  useEffect(() => {
    auth
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
    const expired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED, expired);
    return () => window.removeEventListener(AUTH_EXPIRED, expired);
  }, []);

  // ---- Toast: short message at the bottom of the screen (longer messages stay longer) ----
  const toast = (m) => {
    setMsg(m);
    setTimeout(() => setMsg(""), Math.max(2200, m.length * 60));
  };

  // ---- Navigation helper used by every page ----
  // go("staff", { company: "ESSO" }) -> /staff?company=ESSO;  go("logout") -> sign out, back to the landing page
  const go = (p, params) => {
    if (p === "logout") {
      auth.logout().finally(() => {
        setUser(null);
        navigate(ROUTES.home);
        window.scrollTo(0, 0);
      });
      return;
    }
    const q = params ? "?" + new URLSearchParams(params) : "";
    navigate((ROUTES[p] || "/") + q);
    window.scrollTo(0, 0);
  };

  // ---- Render: nothing until the session check finishes, then the routed page + toast ----
  if (checking) return null;
  const ctx = { go, toast, user, setUser };
  return (
    <>
      <AppRouter ctx={ctx} />
      {msg && <div className="toast">{msg}</div>}
    </>
  );
}
