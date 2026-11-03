/** Pure navigation helpers: active nav item, breadcrumbs and back targets. */

export type Crumb = { label: string; href?: string };
export type BackTarget = { href: string; label: string };

const SECTIONS: Record<string, { label: string; href: string; child: string }> = {
  tools: { label: "Browse", href: "/tools", child: "Tool" },
  "me/requests": { label: "My requests", href: "/me/requests", child: "Request" },
  "me/incoming": { label: "Incoming", href: "/me/incoming", child: "Request" },
  "me/listings": { label: "My listings", href: "/me/listings", child: "Listing" },
  admin: { label: "Admin", href: "/admin", child: "" },
};

function segments(pathname: string): string[] {
  return pathname.split("?")[0].split("/").filter(Boolean);
}

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function activeNavHref(pathname: string, items: { href: string }[]): string | null {
  let best: string | null = null;
  for (const { href } of items) {
    if (isNavActive(pathname, href) && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

function sectionFor(segs: string[]): { key: string; rest: string[] } | null {
  const two = segs.slice(0, 2).join("/");
  if (SECTIONS[two]) return { key: two, rest: segs.slice(2) };
  if (SECTIONS[segs[0]]) return { key: segs[0], rest: segs.slice(1) };
  return null;
}

function titleCase(s: string): string {
  const t = decodeURIComponent(s).replace(/[-_]+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function breadcrumbsFor(pathname: string): Crumb[] {
  const sec = sectionFor(segments(pathname));
  if (!sec || sec.rest.length === 0) return [];
  const s = SECTIONS[sec.key];
  const root: Crumb = { label: s.label, href: s.href };
  const [first, second] = sec.rest;
  if (sec.key === "tools") {
    if (first === "new") return [root, { label: "List a tool" }];
    if (second === "edit") return [root, { label: "Edit tool" }];
    return [root, { label: s.child }];
  }
  if (sec.key === "admin") return [root, { label: titleCase(first) }];
  return [root, { label: s.child }];
}

export function backTargetFor(pathname: string): BackTarget | null {
  const sec = sectionFor(segments(pathname));
  if (!sec || sec.rest.length === 0) return null;
  const s = SECTIONS[sec.key];
  return { href: s.href, label: `Back to ${s.label}` };
}
