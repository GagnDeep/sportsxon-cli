import { useEffect, useState } from "react";
import { useStdout } from "ink";

export interface AsyncState<T> {
  loading: boolean;
  data?: T;
  error?: string;
  /** How many times this query has resolved — distinguishes first load from refresh. */
  loads: number;
}

/** Run an async fn on mount (and when `deps` change); track loading/data/error. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true, loads: 0 });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fn()
      .then((data) => alive && setState((s) => ({ loading: false, data, loads: s.loads + 1 })))
      .catch((e: Error) => alive && setState((s) => ({ loading: false, error: e.message, loads: s.loads + 1 })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/** A counter that increments every `ms` — use as a dependency to auto-refresh. */
export function useTick(ms: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

/** Live terminal dimensions, so layouts can be responsive. */
export function useDimensions(): { columns: number; rows: number } {
  const { stdout } = useStdout();
  const [dim, setDim] = useState({
    columns: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  });
  useEffect(() => {
    if (!stdout) return;
    const onResize = () => setDim({ columns: stdout.columns ?? 80, rows: stdout.rows ?? 24 });
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);
  return dim;
}

/** A clock string (HH:MM), refreshed every second. */
export function useClock(): string {
  useTick(1000);
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
