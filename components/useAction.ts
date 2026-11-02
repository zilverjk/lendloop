"use client";

import { useCallback, useState } from "react";
import { friendlyError } from "@/lib/errors";

/** Wrap an async mutation call with pending + friendly error state. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setPending(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(friendlyError(e));
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);
  return { pending, error, run, clearError: () => setError(null) };
}
