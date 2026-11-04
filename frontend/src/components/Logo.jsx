// LADOL logo; clicking it goes to the dashboard (staff are redirected to My Profile).
export function Logo({ go, height = 45 }) {
  return (
    <a onClick={() => go("dash")} style={{ cursor: "pointer", display: "inline-flex" }}>
      <img src="/images/ladol-logo.jpg" alt="LADOL" style={{ height }} />
    </a>
  );
}
