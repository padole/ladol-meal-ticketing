import { Logo } from "./Logo";

// White top bar: logo on the left, page-specific links + Logout on the right.
export function Navbar({ go, children }) {
  return (
    <div className="nav">
      <Logo go={go} />
      <div>
        {children}
        <a className="out" onClick={() => go("logout")}>
          Logout
        </a>
      </div>
    </div>
  );
}
