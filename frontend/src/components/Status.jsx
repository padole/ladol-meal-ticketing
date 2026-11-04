// Loading / error line shown above tables while API data is fetched.
export const Status = ({ loading, error, retry }) =>
  error ? (
    <p style={{ color: "#dc2626" }}>
      ⚠ {error.message}{" "}
      {retry && (
        <a style={{ textDecoration: "underline" }} onClick={retry}>
          Retry
        </a>
      )}
    </p>
  ) : loading ? (
    <p style={{ color: "var(--mut)" }}>Loading…</p>
  ) : null;
