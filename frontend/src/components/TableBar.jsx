// Toolbar above tables: search box on the left, buttons (children) on the right.
// pass q/setQ to make the search box work (pages that don't keep it as a placeholder)
export const Bar = ({ ph, q, setQ, children }) => (
  <div className="bar">
    <input type="search" placeholder={ph} value={q} onChange={setQ && ((e) => setQ(e.target.value))} />
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>
  </div>
);

// Footer under tables: record count (the page numbers are decorative).
export const Foot = ({ n }) => (
  <div className="pg">
    <span>Showing {n} records</span>
    <span>‹ 1 2 3 ›</span>
  </div>
);
