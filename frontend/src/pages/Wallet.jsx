import { useState } from "react";
import { Status } from "../components/Status";
import { wallet } from "../api";
import { useApi } from "../hooks/useApi";
import { N } from "../utils/format";

// Wallet page (admins): every wallet top-up, with department filter, search, sort and Fund Account.
export function Wallet({ toast }) {
  // ---- Filters, selection and API data ----
  const [dept, setDept] = useState("");
  const [asc, setAsc] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState([]);
  const [open, setOpen] = useState(false);
  const DEPTS = useApi(wallet.departments).data || [];
  const { data, loading, error, reload } = useApi(() => wallet.topups(dept), [dept]);
  const [f, setF] = useState({ staff_no: "", staff_name: "", department: "", amount: "" });
  // "2026-10-06" -> "Oct 06, 2026"
  const fd = (d) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  // ---- Rows after search + date sort ----
  const rows = (data || [])
    .filter((r) => (r.staff_no + r.staff_name + r.department).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (asc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  // ---- Toolbar actions: reset filters, (de)select rows ----
  const clear = () => {
    setDept("");
    setQ("");
    setAsc(false);
    setSel([]);
    reload();
  };
  const all = rows.length > 0 && rows.every((r) => sel.includes(r.id));
  const tg = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  // ---- Fund Account: an admin adds money to a staff wallet ----
  const fund = () => {
    const t = { ...f, department: f.department || DEPTS[0] };
    if (!t.staff_no || !t.staff_name || !+t.amount) return toast("Complete all fields");
    wallet
      .fund(t)
      .then((r) => {
        setOpen(false);
        setF({ staff_no: "", staff_name: "", department: "", amount: "" });
        toast("Account funded: " + N(r.amount));
        reload();
      })
      .catch((e) => toast(e.message));
  };
  // ---- Render ----
  return (
    <>
      {/* Toolbar: filters on the left; Export / Fund Account / search on the right */}
      <div className="bar">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn gr" onClick={clear}>
            Clear Filter
          </button>
          <select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">Filter by Department</option>
            {DEPTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select value={asc ? "a" : "d"} onChange={(e) => setAsc(e.target.value === "a")}>
            <option value="a">Sort: Ascending</option>
            <option value="d">Sort: Descending</option>
          </select>
          <button className="ib" style={{ width: 42, height: 42 }} title="Refresh" onClick={clear}>
            ⟳
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn ol"
            disabled={!sel.length}
            style={{ opacity: sel.length ? 1 : 0.5 }}
            onClick={() => toast("Exported " + sel.length + " record(s)")}
          >
            Export
          </button>
          <button className="btn gr" onClick={() => setOpen(true)}>
            Fund Account
          </button>
          <input type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <Status loading={loading} error={error} retry={reload} />
      {/* Top-ups table with row checkboxes */}
      <div className="card tw wt" style={{ padding: 0, maxHeight: 540, overflowY: "auto" }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={all}
                  onChange={() => setSel(all ? [] : rows.map((r) => r.id))}
                  style={{ minHeight: 0 }}
                />
              </th>
              <th>Date</th>
              <th>Staff ID</th>
              <th>Staff Name</th>
              <th>Department</th>
              <th style={{ textAlign: "right" }}>Top up Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={sel.includes(r.id)}
                    onChange={() => tg(r.id)}
                    style={{ minHeight: 0 }}
                  />
                </td>
                <td>{fd(r.date)}</td>
                <td>{r.staff_no}</td>
                <td>{r.staff_name}</td>
                <td>{r.department}</td>
                <td style={{ textAlign: "right" }}>{N(r.amount)}.00</td>
              </tr>
            ))}
            {data && !rows.length && (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", color: "var(--mut)" }}>
                  No top-ups found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <b style={{ fontSize: 12, display: "block", marginTop: 8 }}>
        Rows: {rows.length}
        {sel.length > 0 && " · Selected: " + sel.length}
      </b>
      {/* Fund Account pop-up */}
      {open && (
        <div className="modal">
          <div className="card" style={{ textAlign: "left", width: "100%" }}>
            <h3 style={{ marginTop: 0 }}>Fund Account</h3>
            <div className="f2" style={{ gridTemplateColumns: "1fr" }}>
              <div>
                <label>Staff ID</label>
                <input
                  value={f.staff_no}
                  onChange={(e) => setF({ ...f, staff_no: e.target.value })}
                  placeholder="EMP000000"
                />
              </div>
              <div>
                <label>Staff Name</label>
                <input value={f.staff_name} onChange={(e) => setF({ ...f, staff_name: e.target.value })} />
              </div>
              <div>
                <label>Department</label>
                <select value={f.department || DEPTS[0]} onChange={(e) => setF({ ...f, department: e.target.value })}>
                  {DEPTS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Top up Amount (₦)</label>
                <input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
              </div>
            </div>
            <div style={{ textAlign: "right", marginTop: 16 }}>
              <button className="btn ol" onClick={() => setOpen(false)} style={{ marginRight: 8 }}>
                Cancel
              </button>
              <button className="btn gr" onClick={fund}>
                Fund
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
