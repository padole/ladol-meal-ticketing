import { useCallback, useEffect, useRef, useState } from "react";

// Load data from the API inside a component, with loading/error state and a reload() function.
// If the inputs (deps) change quickly, only the latest response is kept.
// const { data, loading, error, reload } = useApi(() => meals.list({ date }), [date]);
export function useApi(fn, deps = []) {
  // ---- State + a counter identifying the latest request ----
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const call = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // ---- Fetch; ignore responses from older requests ----
  const load = useCallback(() => {
    const id = ++call.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    return fn()
      .then((data) => id === call.current && setState({ data, loading: false, error: null }))
      .catch((error) => id === call.current && setState((s) => ({ ...s, loading: false, error })));
  }, deps);
  // ---- Fetch on mount and whenever deps change ----
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}
