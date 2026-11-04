// Maps every URL to its page and applies the access rules (login required, staff vs admin, counter roles).
import { Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "../components/Shell";
import { Login } from "../pages/Login";
import { Landing } from "../pages/Landing";
import { Dash } from "../pages/Dashboard";
import { Companies } from "../pages/Companies";
import { Staff } from "../pages/Staff";
import { Purchases } from "../pages/Purchases";
import { Breakdown } from "../pages/Breakdown";
import { Tx } from "../pages/Transactions";
import { Menu } from "../pages/MenuManagement";
import { Add } from "../pages/AddMeal";
import { Dining } from "../pages/Dining";
import { StaffDining } from "../pages/StaffDining";
import { Wallet } from "../pages/Wallet";
import { Report } from "../pages/Reports";
import { Settings } from "../pages/Settings";
import { Profile } from "../pages/Profile";
import { MyOrders } from "../pages/MyOrders";
import { ROUTES, STAFF_PAGES, homeFor } from "./routes";

export default function AppRouter({ ctx }) {
  // ---- Access guards ----
  const { go, toast, user } = ctx;
  // everything except Login needs a signed-in user; staff only get STAFF_PAGES
  const guard = (el, key) =>
    !user ? (
      <Navigate to={ROUTES.login} replace />
    ) : user.is_admin || STAFF_PAGES.includes(key) ? (
      el
    ) : (
      <Navigate to={ROUTES[homeFor(user)]} replace />
    );
  // Client Dining is a counter: only Administrator / PF Admin
  const counterOnly = (el) => (user && !user.can_order ? <Navigate to={ROUTES[homeFor(user)]} replace /> : el);
  // ---- Route builder for pages that use the standard Shell (navbar + breadcrumb + title) ----
  // pages that use the standard header/breadcrumb layout
  const page = (key, Page) => (
    <Route
      path={ROUTES[key]}
      element={guard(
        <Shell pg={key} go={go} user={user}>
          <Page {...ctx} />
        </Shell>,
        key,
      )}
    />
  );
  // ---- Route table ----
  return (
    <Routes>
      {/* Public: landing page and login (logged-in users are sent to their home page instead) */}
      <Route
        path={ROUTES.home}
        element={user ? <Navigate to={ROUTES[homeFor(user)]} replace /> : <Landing go={go} />}
      />
      <Route
        path={ROUTES.login}
        element={user ? <Navigate to={ROUTES[homeFor(user)]} replace /> : <Login {...ctx} />}
      />
      {/* Admin dashboard + pages inside the standard layout */}
      <Route path={ROUTES.dash} element={guard(<Dash go={go} user={user} />, "dash")} />
      {page("companies", Companies)}
      {page("staff", Staff)}
      {page("purchases", Purchases)}
      {page("breakdown", Breakdown)}
      {page("tx", Tx)}
      {page("menu", Menu)}
      {page("add", Add)}
      {page("report", Report)}
      {page("wallet", Wallet)}
      {page("settings", Settings)}
      {page("profile", Profile)}
      {page("myorders", MyOrders)}
      {/* Full-screen counters: Client Dining (Administrator/PF Admin) and Today's Menu (everyone) */}
      <Route
        path={ROUTES.client}
        element={guard(counterOnly(<Dining key="client" go={go} client toast={toast} user={user} />), "client")}
      />
      <Route path={ROUTES.pos} element={guard(<StaffDining go={go} toast={toast} user={user} />, "pos")} />
      {/* Unknown URL -> front page */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
