import { CATEGORIES, type Category } from "./constants";

export type BrowseView = "grid" | "list";

export const VIEW_STORAGE_KEY = "lendloop:browseView";

export function parseView(param: string | null | undefined): BrowseView {
  return param === "list" ? "list" : "grid";
}

export function parseCategory(param: string | null | undefined): Category | "" {
  return (CATEGORIES as readonly string[]).includes(param ?? "") ? (param as Category) : "";
}

/** Query string (with leading "?", or "" when all defaults) preserving view + category. */
export function buildBrowseQuery({ view, category }: { view: BrowseView; category: Category | "" }): string {
  const p = new URLSearchParams();
  if (category) p.set("category", category);
  if (view === "list") p.set("view", "list");
  const s = p.toString();
  return s ? `?${s}` : "";
}
