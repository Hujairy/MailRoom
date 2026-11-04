/* eslint-disable */
import { useCallback, useState } from 'react';

/** State remembered in this browser (per-person conveniences only). Falls back to memory. */
export function useStored<T extends string>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      return (localStorage.getItem(`mailroom:${key}`) as T | null) ?? initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(`mailroom:${key}`, next);
      } catch {
        // storage unavailable
      }
    },
    [key],
  );
  return [value, set];
}
