import { useState } from "react";
import { companies, staff, wallet } from "../api";
import { useApi } from "../hooks/useApi";

// Blank form (LADOL fields + client fields)
const EMPTY = { employee_no: "", first_name: "", last_name: "", department: "", customer_no: "", name: "" };

// Account Management → Staff List → "+ Add Staff" (Administrator / HR Admin).
// LADOL: creates the employee's login (password set at first login with their surname). Client company: Staff List entry only.
export function AddStaff({ company, onClose, onAdded }) {
  // ---- Data (companies, departments) + form state ----
  const cos = useApi(companies.list).data || [];
  const depts = useApi(wallet.departments).data || [];
  const [co, setCo] = useState(company || "LADOL");
  const [f, setF] = useState(EMPTY);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // ---- Helpers ----
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const ladol = co === "LADOL";
  // ---- Save: send only the fields for the chosen company type ----
  const save = (e) => {
    e.preventDefault();
    setErr("");
    const body = ladol
      ? {
          company: co,
          employee_no: f.employee_no,
          first_name: f.first_name,
          last_name: f.last_name,
          department: f.department,
        }
      : { company: co, customer_no: f.customer_no, name: f.name };
    const required = ladol ? ["employee_no", "first_name", "last_name"] : ["customer_no", "name"];
    if (required.some((k) => !f[k].trim())) return setErr("Fill in all required fields");
    setBusy(true);
    staff
      .create(body)
      .then(onAdded)
      .catch((x) => setErr(x.message))
      .finally(() => setBusy(false));
  };
  // ---- Render ----
  return (
    <div className="modal">
      <form className="card" style={{ textAlign: "left", width: "100%", maxWidth: 460 }} onSubmit={save}>
        <h3 style={{ marginTop: 0 }}>Add Staff</h3>
        <div className="f2" style={{ gridTemplateColumns: "1fr" }}>
          <div>
            <label>Company *</label>
            <select
              value={co}
              onChange={(e) => {
                setCo(e.target.value);
                setErr("");
              }}
            >
              {(cos.length ? cos : [{ id: 0, code: "LADOL", name: "" }]).map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code}
                  {c.name ? ` – ${c.name}` : ""}
                </option>
              ))}
            </select>
          </div>
          {/* LADOL employee fields, or client company fields */}
          {ladol ? (
            <>
              <div>
                <label>Employee No. *</label>
                <input
                  value={f.employee_no}
                  onChange={s("employee_no")}
                  placeholder="e.g. EMP000999"
                  maxLength={20}
                  autoFocus
                  style={{ textTransform: "uppercase" }}
                />
              </div>
              <div className="f2" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label>First name *</label>
                  <input value={f.first_name} onChange={s("first_name")} maxLength={60} />
                </div>
                <div>
                  <label>Surname *</label>
                  <input value={f.last_name} onChange={s("last_name")} maxLength={60} />
                </div>
              </div>
              <div>
                <label>Department</label>
                <input
                  list="dept-list"
                  value={f.department}
                  onChange={s("department")}
                  placeholder="Choose or type a department"
                  maxLength={120}
                />
                <datalist id="dept-list">
                  {depts.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>
              <p style={{ margin: 0, color: "var(--mut)", fontSize: 13 }}>
                This creates their login as an <b>Employee</b>. At first login they enter their employee no., confirm
                their surname and choose a password.
              </p>
            </>
          ) : (
            <>
              <div>
                <label>Staff ID *</label>
                <input
                  value={f.customer_no}
                  onChange={s("customer_no")}
                  placeholder={`e.g. ${co}-001`}
                  maxLength={20}
                  autoFocus
                  style={{ textTransform: "uppercase" }}
                />
              </div>
              <div>
                <label>Full name *</label>
                <input value={f.name} onChange={s("name")} maxLength={120} />
              </div>
              <p style={{ margin: 0, color: "var(--mut)", fontSize: 13 }}>
                Client company staff are listed for Client Dining and purchase history; they don't get a login.
              </p>
            </>
          )}
        </div>
        {/* Error + Cancel / Add */}
        {err && <p style={{ color: "#dc2626", margin: "12px 0 0" }}>{err}</p>}
        <div style={{ textAlign: "right", marginTop: 16 }}>
          <button type="button" className="btn ol" onClick={onClose} style={{ marginRight: 8 }}>
            Cancel
          </button>
          <button className="btn" disabled={busy}>
            {busy ? "Adding…" : "Add Staff"}
          </button>
        </div>
      </form>
    </div>
  );
}
