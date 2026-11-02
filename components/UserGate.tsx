"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { friendlyError } from "@/lib/errors";
import { ErrorText, Loading } from "./ui";

/** Ensures the users row exists (users.store) before rendering signed-in pages. */
export function UserGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const store = useMutation(api.users.store);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    store()
      .then(() => !cancelled && setReady(true))
      .catch((e) => !cancelled && setError(friendlyError(e)));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, store]);

  if (error) return <ErrorText message={error} />;
  if (isLoading || (isAuthenticated && !ready)) return <Loading label="Setting up your account…" />;
  if (!isAuthenticated) return <Loading label="Signing you in…" />;
  return <>{children}</>;
}
