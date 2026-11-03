"use client";

import { useAuth } from "@clerk/nextjs";

/** Subtitle for the home "Available now" section; follows the browser's Clerk session. */
export function AvailableSubtitle() {
  const { isLoaded, isSignedIn } = useAuth();
  return (
    <p className="mb-6 mt-1 text-muted">
      {!isLoaded
        ? "A peek at what neighbors are lending right now."
        : isSignedIn
          ? "Pick one and request it for the dates you need."
          : "A peek at what neighbors are lending right now. Sign in to request one."}
    </p>
  );
}
