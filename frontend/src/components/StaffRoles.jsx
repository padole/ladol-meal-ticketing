import { useEffect, useState } from "react";
import { users } from "../api";
import { useApi } from "../hooks/useApi";
import { Status } from "./Status";

// What each role can do - keep in step with backend/app/models.py (User.is_admin / ORDER_ROLES) and routes/users.py
export const ROLE_RIGHTS = {
  Employee: "Today's Menu (view only), My Profile, My Orders, wallet top-up",
  "PF Admin": "All admin pages + serve staff meals, Client Dining orders and add companies",
  "HR Admin": "All admin pages + add staff; can't place orders",
  Administrator: "Everything, incl. serving meals, adding staff/companies and managing staff roles",
  "Commercial Admin": "All admin pages (menu, reports, transactions, wallet, settings); can't place orders",
  Finance: "All admin pages (menu, reports, transactions, wallet, settings); can't place orders",
};
// Description for any role not listed above
const rights = (r) => ROLE_RIGHTS[r] || "All admin pages; can't place orders";

// Settings → Staff Roles & Permissions (Administrator only)
export function StaffRoles({ me, toast }) {
  // ---- Filters, paging and the two confirmation dialogs ----
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(null); // {u, role} waiting for confirmation
  const [resetting, setResetting] = useState(null); // user whose password reset is waiting for confirmation
  // ---- Search waits 300 ms after typing stops, then goes back to page 1 ----
  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  // ---- Data ----
  const { data, loading, error, reload } = useApi(() => users.list({ q: term, role, page }), [term, role, page]);
  const roles = data?.roles || [];
  // ---- Actions: change role, reset password (both after confirmation) ----
  const apply = () =>
    users
      .setRole(pending.u.id, pending.role)
      .then((u) => {
        toast(`${u.full_name} is now ${u.role}`);
        setPending(null);
        reload();
      })
      .catch((e) => {
        toast(e.message);
        setPending(null);
      });
  const reset = () =>
    users
      .resetPassword(resetting.id)
      .then((u) => {
        toast(`Password reset for ${u.full_name}`);
        setResetting(null);
        reload();
      })
      .catch((e) => {
        toast(e.message);
        setResetting(null);
      });

  // ---- Render ----
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h4 style={{ marginTop: 0 }}>Staff Roles &amp; Permissions</h4>
      <p style={{ color: "var(--mut)", marginTop: -4, fontSize: 13 }}>
        Give an employee rights by changing their role. Changes apply the next time they load a page.
      </p>
      {/* Role key: what each role can do + how many people have it */}
      <div className="f2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", marginBottom: 14 }}>
        {roles.map((r) => (
          <div key={r} style={{ background: "var(--soft)", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
            <b>{r}</b> <span style={{ color: "var(--mut)" }}>· {data?.role_counts?.[r] || 0}</span>
            <br />
            <span style={{ color: "var(--mut)" }}>{rights(r)}</span>
          </div>
        ))}
      </div>
      {/* Search + role filter */}
      <div className="bar">
        <input
          type="search"
          placeholder="Search by name or employee no."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      <Status loading={loading} error={error} retry={reload} />
      {/* Staff table: account status, role dropdown, reset password */}
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Employee No.</th>
              <th>Name</th>
              <th>Department</th>
              <th>Account</th>
              <th>Role</th>
              <th>Password</th>
            </tr>
          </thead>
          <tbody>
            {(data?.users || []).map((u) => (
              <tr key={u.id}>
                <td style={{ fontFamily: "monospace" }}>{u.employee_no}</td>
                <td>
                  <b>{u.full_name}</b>
                  {u.id === me.id && <small style={{ color: "var(--mut)" }}> (you)</small>}
                </td>
                <td>{u.department || "—"}</td>
                <td>
                  {u.locked ? (
                    <span className="pill no">Locked</span>
                  ) : u.has_password ? (
                    <span className="pill ok">Active</span>
                  ) : (
                    <span className="pill sch">Not set up</span>
                  )}
                </td>
                <td>
                  <select
                    value={u.role}
                    disabled={u.id === me.id}
                    title={u.id === me.id ? "You can't change your own role" : rights(u.role)}
                    onChange={(e) => setPending({ u, role: e.target.value })}
                  >
                    {roles.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td>
                  {u.id === me.id ? (
                    <small style={{ color: "var(--mut)" }}>Use My Profile</small>
                  ) : (
                    <button
                      className="btn ol"
                      style={{ padding: "6px 12px", whiteSpace: "nowrap" }}
                      disabled={!u.has_password && !u.locked}
                      title={
                        !u.has_password && !u.locked
                          ? "No password set yet"
                          : "They create a new password at next login"
                      }
                      onClick={() => setResetting(u)}
                    >
                      {u.locked ? "Unlock & reset" : "Reset password"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {data && !data.users.length && (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", color: "var(--mut)" }}>
                  No staff match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {data && (
        <div className="pg">
          <span>{data.total} staff</span>
          {data.pages > 1 && (
            <span>
              <button
                className="btn ol"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                style={{ marginRight: 6 }}
              >
                ‹ Previous
              </button>
              <span style={{ marginRight: 6 }}>
                Page {data.page} of {data.pages}
              </span>
              <button className="btn ol" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
                Next ›
              </button>
            </span>
          )}
        </div>
      )}
      {/* Confirm: reset password */}
      {resetting && (
        <div className="modal">
          <div className="card" style={{ width: "100%", textAlign: "left" }}>
            <h3 style={{ marginTop: 0 }}>Reset password?</h3>
            <p>
              <b>{resetting.full_name}</b> ({resetting.employee_no})
            </p>
            <p style={{ color: "var(--mut)", fontSize: 13 }}>
              Their current password stops working{resetting.locked ? " and the lockout is cleared" : ""}. Next time
              they log in with their employee no., they confirm their surname and choose a new password.
            </p>
            <div style={{ textAlign: "right" }}>
              <button className="btn ol" onClick={() => setResetting(null)} style={{ marginRight: 8 }}>
                Cancel
              </button>
              <button className="btn rd" onClick={reset}>
                Reset password
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirm: change role */}
      {pending && (
        <div className="modal">
          <div className="card" style={{ width: "100%", textAlign: "left" }}>
            <h3 style={{ marginTop: 0 }}>Change role?</h3>
            <p>
              <b>{pending.u.full_name}</b> ({pending.u.employee_no})<br />
              {pending.u.role} → <b>{pending.role}</b>
            </p>
            <p style={{ color: "var(--mut)", fontSize: 13 }}>They will be able to: {rights(pending.role)}.</p>
            <div style={{ textAlign: "right" }}>
              <button className="btn ol" onClick={() => setPending(null)} style={{ marginRight: 8 }}>
                Cancel
              </button>
              <button className="btn" onClick={apply}>
                Change role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
