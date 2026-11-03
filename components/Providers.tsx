"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { EnsureUser } from "./EnsureUser";
import type { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function Providers({ children }: { children: ReactNode }) {
  // Without a Convex URL (e.g. a bare CI build) render children unwrapped so
  // the build still succeeds; pages using Convex hooks need real env at runtime.
  if (!convex) return <ClerkProvider>{children}</ClerkProvider>;
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <EnsureUser />
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
