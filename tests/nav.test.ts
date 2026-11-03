import { describe, expect, it } from "vitest";
import { activeNavHref, backTargetFor, breadcrumbsFor, isNavActive } from "../lib/nav";

const ITEMS = [
  { href: "/tools" },
  { href: "/me/listings" },
  { href: "/me/requests" },
  { href: "/me/incoming" },
  { href: "/admin" },
];

describe("isNavActive", () => {
  it("matches exact and nested paths on segment boundaries", () => {
    expect(isNavActive("/tools", "/tools")).toBe(true);
    expect(isNavActive("/tools/new", "/tools")).toBe(true);
    expect(isNavActive("/tools/abc/edit", "/tools")).toBe(true);
    expect(isNavActive("/toolsx", "/tools")).toBe(false);
    expect(isNavActive("/", "/tools")).toBe(false);
  });
});

describe("activeNavHref", () => {
  it.each([
    ["/tools", "/tools"],
    ["/tools/new", "/tools"],
    ["/tools/abc", "/tools"],
    ["/tools/abc/edit", "/tools"],
    ["/me/requests", "/me/requests"],
    ["/me/requests/x", "/me/requests"],
    ["/me/incoming/x", "/me/incoming"],
    ["/me/listings/x", "/me/listings"],
    ["/admin/users", "/admin"],
  ])("%s -> %s", (p, href) => expect(activeNavHref(p, ITEMS)).toBe(href));

  it("returns null when nothing matches and picks the longest prefix", () => {
    expect(activeNavHref("/", ITEMS)).toBeNull();
    expect(activeNavHref("/toolsx", ITEMS)).toBeNull();
    expect(activeNavHref("/me/a/b", [{ href: "/me" }, { href: "/me/a" }])).toBe("/me/a");
  });
});

describe("breadcrumbsFor", () => {
  it("is empty for top-level pages", () => {
    for (const p of ["/", "/tools", "/me/requests", "/me/incoming", "/me/listings", "/admin"]) {
      expect(breadcrumbsFor(p)).toEqual([]);
    }
  });
  it("builds trails for sub-pages", () => {
    expect(breadcrumbsFor("/tools/new")).toEqual([{ label: "Browse", href: "/tools" }, { label: "List a tool" }]);
    expect(breadcrumbsFor("/tools/abc/edit")).toEqual([{ label: "Browse", href: "/tools" }, { label: "Edit tool" }]);
    expect(breadcrumbsFor("/tools/abc")).toEqual([{ label: "Browse", href: "/tools" }, { label: "Tool" }]);
    expect(breadcrumbsFor("/admin/x")).toEqual([{ label: "Admin", href: "/admin" }, { label: "X" }]);
    expect(breadcrumbsFor("/me/requests/42")).toEqual([{ label: "My requests", href: "/me/requests" }, { label: "Request" }]);
    expect(breadcrumbsFor("/me/incoming/42")).toEqual([{ label: "Incoming", href: "/me/incoming" }, { label: "Request" }]);
  });
  it("ignores trailing slashes", () => {
    expect(breadcrumbsFor("/tools/new/")).toHaveLength(2);
  });
});

describe("backTargetFor", () => {
  it("is null for top-level pages", () => {
    expect(backTargetFor("/")).toBeNull();
    expect(backTargetFor("/tools")).toBeNull();
    expect(backTargetFor("/admin")).toBeNull();
  });
  it("points to the logical parent", () => {
    expect(backTargetFor("/tools/new")).toEqual({ href: "/tools", label: "Back to Browse" });
    expect(backTargetFor("/tools/abc/edit")).toEqual({ href: "/tools", label: "Back to Browse" });
    expect(backTargetFor("/tools/abc")).toEqual({ href: "/tools", label: "Back to Browse" });
    expect(backTargetFor("/me/requests/1")).toEqual({ href: "/me/requests", label: "Back to My requests" });
    expect(backTargetFor("/me/incoming/1")).toEqual({ href: "/me/incoming", label: "Back to Incoming" });
    expect(backTargetFor("/admin/x")).toEqual({ href: "/admin", label: "Back to Admin" });
  });
});
