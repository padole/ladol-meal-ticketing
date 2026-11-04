import { useState } from "react";
import { Bar, Foot } from "../components/TableBar";
import { Status } from "../components/Status";
import { companies } from "../api";
import { useApi } from "../hooks/useApi";

// Account Management: list of companies with staff/transaction counts; Administrators and PF Admins can add companies.

// Blank "Add Company" form
const EMPTY = { code: "", name: "", color: "#0d6efd" };

export function Companies({ go, user, toast }) {
  // ---- Data + state ----
  const { data, loading, error, reload } = useApi(companies.list);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // ---- Search filter (code or name) ----
  const rows = (data || []).filter((c) => (c.code + " " + c.name).toLowerCase().includes(q.trim().toLowerCase()));
  // ---- Add Company form: close/reset and save ----
  const close = () => {
    setOpen(false);
    setF(EMPTY);
    setErr("");
  };
  const save = (e) => {
    e.preventDefault();
    setErr("");
    if (!f.code.trim() || !f.name.trim()) return setErr("Enter a code and the company name");
    setBusy(true);
    companies
      .create({ ...f, code: f.code.trim().toUpperCase() })
      .then((c) => {
        toast(`${c.code} added`);
        close();
        reload();
      })
      .catch((x) => setErr(x.message))
      .finally(() => setBusy(false));
  };
  // ---- Render ----
  return (
    <>
      {/* Search box + Add Company button (only for roles allowed to add) */}
      <Bar ph="Search company by name..." q={q} setQ={setQ}>
        {user.can_manage_companies && (
          <button className="btn dk" onClick={() => setOpen(true)}>
            + Add Company
          </button>
        )}
      </Bar>
      <Status loading={loading} error={error} retry={reload} />
      {/* Companies table; the eye buttons open that company's staff list / transactions */}
      <div className="card tw">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Registered Staff</th>
              <th>Transactions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <span className="av" style={{ background: c.color }}>
                    {c.code.slice(0, 2)}
                  </span>
                  <b>{c.code}</b> <small style={{ color: "var(--mut)" }}>{c.name}</small>
                </td>
                <td>
                  {c.staff_count}{" "}
                  <button className="ib" onClick={() => go("staff", { company: c.code })}>
                    👁
                  </button>
                </td>
                <td>
                  {c.transaction_count}{" "}
                  <button className="ib" onClick={() => go("tx", { company: c.code })}>
                    👁
                  </button>
                </td>
              </tr>
            ))}
            {data && !rows.length && (
              <tr>
                <td colSpan="3" style={{ textAlign: "center", color: "var(--mut)" }}>
                  No companies match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Foot n={rows.length} />
      </div>
      {/* Add Company pop-up form */}
      {open && (
        <div className="modal">
          <form className="card" style={{ textAlign: "left", width: "100%", maxWidth: 440 }} onSubmit={save}>
            <h3 style={{ marginTop: 0 }}>Add Company</h3>
            <div className="f2" style={{ gridTemplateColumns: "1fr" }}>
              <div>
                <label>Company code *</label>
                <input
                  value={f.code}
                  onChange={(e) => setF({ ...f, code: e.target.value })}
                  placeholder="e.g. ESSO"
                  maxLength={20}
                  autoFocus
                  style={{ textTransform: "uppercase" }}
                />
              </div>
              <div>
                <label>Company name *</label>
                <input
                  value={f.name}
                  onChange={(e) => setF({ ...f, name: e.target.value })}
                  placeholder="e.g. ExxonMobil"
                  maxLength={120}
                />
              </div>
              <div>
                <label>Colour</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="color"
                    value={f.color}
                    onChange={(e) => setF({ ...f, color: e.target.value })}
                    style={{ width: 56, padding: 4 }}
                  />
                  <span className="av" style={{ background: f.color, margin: 0 }}>
                    {(f.code.trim() || "AB").slice(0, 2).toUpperCase()}
                  </span>
                  <small style={{ color: "var(--mut)" }}>Badge shown next to the company</small>
                </div>
              </div>
            </div>
            {err && <p style={{ color: "#dc2626", margin: "12px 0 0" }}>{err}</p>}
            <div style={{ textAlign: "right", marginTop: 16 }}>
              <button type="button" className="btn ol" onClick={close} style={{ marginRight: 8 }}>
                Cancel
              </button>
              <button className="btn" disabled={busy}>
                {busy ? "Adding…" : "Add Company"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
