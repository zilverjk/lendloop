"use client";

import { useConvexAuth } from "convex/react";
import type { ReactNode } from "react";
import { friendlyError } from "@/lib/errors";
import { useEnsureUser } from "./EnsureUser";
import { ErrorText, Loading } from "./ui";

/** Ensures the users row exists (users.store) before rendering signed-in pages. */
export function UserGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { ready, error: rawError } = useEnsureUser();
  const error = rawError ? friendlyError(rawError) : null;

  if (error) return <ErrorText message={error} />;
  if (isLoading || (isAuthenticated && !ready)) return <Loading label="Setting up your account…" />;
  if (!isAuthenticated) return <Loading label="Signing you in…" />;
  return <>{children}</>;
}
