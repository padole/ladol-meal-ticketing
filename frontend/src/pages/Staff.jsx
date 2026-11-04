import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bar, Foot } from "../components/TableBar";
import { Status } from "../components/Status";
import { staff } from "../api";
import { useApi } from "../hooks/useApi";
import { AddStaff } from "../components/AddStaff";

// Account Management → Staff List: LADOL employees and client company staff, optionally filtered by company.
// Administrators and HR Admins can add staff.
export function Staff({ go, user, toast }) {
  // ---- Data + state ----
  const [adding, setAdding] = useState(false);
  const co = useSearchParams()[0].get("company");
  const { data, loading, error, reload } = useApi(() => staff.list(co), [co]);
  const [q, setQ] = useState("");
  // ---- Search filter (ID, name or department) ----
  const rows = (data || []).filter((s) =>
    (s.customer_no + " " + s.name + " " + (s.department || "")).toLowerCase().includes(q.trim().toLowerCase()),
  );
  // ---- Render ----
  return (
    <>
      {/* Search box, Export (not built yet) and Add Staff (Administrator / HR Admin only) */}
      <Bar ph="Search by name, ID or department..." q={q} setQ={setQ}>
        <button className="btn ol">⬇ Export</button>
        {user.can_add_staff && (
          <button className="btn dk" onClick={() => setAdding(true)}>
            + Add Staff
          </button>
        )}
      </Bar>
      {/* Which company is being shown */}
      {co && (
        <p>
          Filtered by <b>{co}</b> ·{" "}
          <a style={{ color: "var(--pri)" }} onClick={() => go("staff")}>
            show all
          </a>
        </p>
      )}
      <Status loading={loading} error={error} retry={reload} />
      {/* Staff table; the eye button opens their purchase history */}
      <div className="card tw">
        <table>
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Name</th>
              <th>Company</th>
              <th>Department</th>
              <th>Eligible</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td style={{ fontFamily: "monospace" }}>{s.customer_no}</td>
                <td>
                  <span className="av">
                    {s.name
                      .split(" ")
                      .map((x) => x[0])
                      .join("")}
                  </span>
                  {s.name}
                </td>
                <td>
                  {s.company}
                  {s.employee && (
                    <>
                      {" "}
                      <span className="pill Lunch" style={{ fontSize: 10, padding: "2px 8px" }}>
                        Employee
                      </span>
                    </>
                  )}
                </td>
                <td>{s.department || "—"}</td>
                <td>
                  <span className={"pill " + (s.eligible ? "ok" : "no")}>
                    {s.eligible ? "✓ Eligible" : "✕ Not Eligible"}
                  </span>
                </td>
                <td>
                  <button className="ib" onClick={() => go("purchases", { staff: s.id })}>
                    👁
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Foot n={rows.length} />
      </div>
      {/* Add Staff pop-up form */}
      {adding && (
        <AddStaff
          company={co}
          onClose={() => setAdding(false)}
          onAdded={(s) => {
            setAdding(false);
            toast(`${s.name} (${s.customer_no}) added to ${s.company}`);
            reload();
          }}
        />
      )}
    </>
  );
}
