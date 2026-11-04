import { Navbar } from "../components/Navbar";
import { TILES } from "../data/dashboard";

// Admin home page: welcome banner and a grid of tiles linking to each area (tiles come from data/dashboard.js).
export function Dash({ go, user }) {
  return (
    <div>
      <Navbar go={go}>
        <a>Help</a>
      </Navbar>
      {/* Welcome banner */}
      <div className="hero">
        <h2 style={{ margin: 0 }}>Welcome back {user.full_name}!</h2>
        <input placeholder="🔍  How can we be of help today?" />
      </div>
      <div className="wrap">
        {/* Tiles (dimmed = not built yet) */}
        <div className="grid">
          {TILES.map(([t, d, i, to]) => (
            <a key={t} className={"tile " + (to ? "on" : "off")} onClick={() => to && go(to)}>
              <div>
                <h4>{t}</h4>
                <p>{d}</p>
              </div>
              <span className="ic">{i}</span>
            </a>
          ))}
        </div>
        <p style={{ color: "var(--mut)", fontSize: 12, marginTop: 18 }}>
          Dimmed tiles are not built yet in this preview.
        </p>
      </div>
    </div>
  );
}
