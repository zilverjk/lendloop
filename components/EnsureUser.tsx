"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { createUserEnsurer } from "@/lib/ensureUser";

/** Shared across EnsureUser and UserGate so `users.store` runs once per session. */
let shared: ReturnType<typeof createUserEnsurer> | null = null;
let sharedStore: unknown = null;

function ensurerFor(store: () => Promise<unknown>) {
  if (!shared || sharedStore !== store) {
    shared = createUserEnsurer(store);
    sharedStore = store;
  }
  return shared;
}

/** Upserts the Convex users row once the Convex client is authenticated. */
export function useEnsureUser() {
  const { isAuthenticated } = useConvexAuth();
  const store = useMutation(api.users.store);
  const [state, setState] = useState<{ ready: boolean; error: unknown }>({
    ready: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    ensurerFor(store)
      .ensure(isAuthenticated)
      .then(() => !cancelled && setState({ ready: isAuthenticated, error: null }))
      .catch((error) => !cancelled && setState({ ready: false, error }));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, store]);

  return state;
}

/** Mount once inside the Convex provider; renders nothing. */
export function EnsureUser() {
  const { error } = useEnsureUser();
  useEffect(() => {
    // No PII: log only that it failed; UserGate surfaces details on (app) pages.
    if (error) console.warn("LendLoop: could not sync your account yet.");
  }, [error]);
  return null;
}
