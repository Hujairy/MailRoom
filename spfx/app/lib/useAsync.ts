/* eslint-disable */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

/** Loads data when `deps` change and exposes a reload. Ignores stale responses. */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const run = useRef(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    const id = ++run.current;
    setLoading(true);
    try {
      const result = await loadRef.current();
      if (id === run.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (id === run.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === run.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setData(null);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload };
}
