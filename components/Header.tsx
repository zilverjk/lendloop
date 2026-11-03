"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { Menu, Repeat, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { activeNavHref } from "@/lib/nav";
import { buttonClass } from "./ui";

function NavLink({ href, children, active, mobile = false }: { href: string; children: string; active: boolean; mobile?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg text-sm font-medium transition-colors ${mobile ? "block px-3 py-2.5" : "px-3 py-2"} ${
        active ? "bg-brand-100 text-brand-800" : "text-muted hover:bg-surface-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function useNavLinks() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const links = [
    { href: "/tools", label: "Browse" },
    { href: "/me/listings", label: "My listings" },
    { href: "/me/requests", label: "My requests" },
    { href: "/me/incoming", label: "Incoming" },
  ];
  if (me?.role === "admin") links.push({ href: "/admin", label: "Admin" });
  return links;
}

function SignedInNav() {
  const links = useNavLinks();
  const pathname = usePathname();
  const activeHref = activeNavHref(pathname, links);
  // Menu is open only for the path it was opened on, so any route change closes it.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenFor(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
        {links.map((l) => (
          <NavLink key={l.href} href={l.href} active={l.href === activeHref}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-lg text-ink hover:bg-surface-muted md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpenFor(open ? null : pathname)}
        >
          {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
        </button>
        <UserButton />
      </div>
      <nav
        id="mobile-menu"
        aria-label="Main (mobile)"
        hidden={!open}
        className="basis-full border-t border-line pb-3 pt-2 md:hidden"
      >
        <ul className="grid gap-1">
          {links.map((l) => (
            <li key={l.href}>
              <NavLink href={l.href} active={l.href === activeHref} mobile>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-0 px-4 py-2.5">
        <Link href="/" className="flex min-h-10 items-center gap-2 rounded-lg text-lg font-semibold tracking-tight text-brand-800">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Repeat aria-hidden className="size-4" />
          </span>
          LendLoop
        </Link>
        <Show when="signed-in">
          <SignedInNav />
        </Show>
        <Show when="signed-out">
          <div className="ml-auto">
            <SignInButton mode="modal">
              <button type="button" className={buttonClass({ size: "sm" })}>
                Sign in
              </button>
            </SignInButton>
          </div>
        </Show>
      </div>
    </header>
  );
}
