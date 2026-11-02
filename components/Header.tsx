"use client";

import { Show, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/convex/_generated/api";

function NavLink({ href, children }: { href: string; children: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-indigo-600 ${
        active ? "bg-indigo-50 font-medium text-indigo-700" : "text-zinc-700 hover:bg-zinc-100"
      }`}
    >
      {children}
    </Link>
  );
}

function AppNav() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  return (
    <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
      <NavLink href="/tools">Browse</NavLink>
      <NavLink href="/me/listings">My listings</NavLink>
      <NavLink href="/me/requests">My requests</NavLink>
      <NavLink href="/me/incoming">Incoming</NavLink>
      {me?.role === "admin" && <NavLink href="/admin">Admin</NavLink>}
    </nav>
  );
}

export function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/" className="text-lg font-semibold text-indigo-700">
            LendLoop
          </Link>
          <Show when="signed-in">
            <AppNav />
          </Show>
        </div>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>
    </header>
  );
}
