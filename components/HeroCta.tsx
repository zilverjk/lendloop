"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { ArrowRight, LogIn, Plus } from "lucide-react";
import Link from "next/link";
import { buttonClass, Skeleton } from "./ui";

/**
 * Client-side so the CTA follows the browser's Clerk session (the server-side
 * auth() on this deployment can disagree with the client).
 */
export function HeroCta() {
  const { isLoaded, isSignedIn } = useAuth();

  // Fixed-height wrapper: no layout shift between skeleton and the real buttons.
  return (
    <div className="mt-8 flex min-h-12 flex-wrap items-center gap-3">
      {!isLoaded ? (
        <>
          <span className="sr-only" role="status">
            Checking your session…
          </span>
          <Skeleton className="h-12 w-56 rounded-lg" />
          <Skeleton className="h-12 w-44 rounded-lg" />
        </>
      ) : isSignedIn ? (
        <>
          <Link href="/tools" className={buttonClass({ size: "lg" })}>
            Browse tools
            <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link href="/tools/new" className={buttonClass({ variant: "secondary", size: "lg" })}>
            <Plus aria-hidden className="size-4" />
            List a tool
          </Link>
        </>
      ) : (
        <>
          <SignInButton mode="modal">
            <button type="button" className={buttonClass({ size: "lg" })}>
              <LogIn aria-hidden className="size-4" />
              Sign in to lend or borrow
            </button>
          </SignInButton>
          <a href="#available" className={buttonClass({ variant: "secondary", size: "lg" })}>
            See what&apos;s available
          </a>
        </>
      )}
    </div>
  );
}
