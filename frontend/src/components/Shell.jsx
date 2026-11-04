import { useSearchParams } from "react-router-dom";
import { Navbar } from "./Navbar";
import { TITLE, TRAIL } from "../data/navigation";
import { STAFF_PAGES } from "../router/routes";

// Standard page layout: navbar, blue header with breadcrumb + title, then the page content.
export function Shell({ pg, go, user, children }) {
  // ---- Breadcrumb navigation ----
  const staff = useSearchParams()[0].get("staff");
  // keep the selected staff member when stepping back from Break Down to Purchase History
  const back = (p) => go(p, p === "purchases" && staff ? { staff } : undefined);
  // ---- Render ----
  return (
    <div>
      <Navbar go={go}>{user.is_admin && <a onClick={() => go("dash")}>Dashboard</a>}</Navbar>
      {/* Header: breadcrumb trail (staff only see links they may open) and page title */}
      <div className="hdr">
        <div className="crumbs">
          {(TRAIL[pg] || [])
            .filter(([, p]) => user.is_admin || STAFF_PAGES.includes(p))
            .map(([l, p]) => (
              <span key={p}>
                <a onClick={() => back(p)}>{l}</a> /{" "}
              </span>
            ))}
          <b>{TITLE[pg].replace(/^\S+\s/, "")}</b>
        </div>
        <h2>{TITLE[pg]}</h2>
      </div>
      {/* Page content */}
      <div className="wrap">{children}</div>
    </div>
  );
}
