export const CATEGORIES = [
  "power_tools",
  "hand_tools",
  "garden",
  "kitchen",
  "camping",
  "cleaning",
  "sports",
  "other",
] as const;
export const CONDITIONS = ["new", "good", "fair", "worn"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Condition = (typeof CONDITIONS)[number];

export function labelize(s: string): string {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || "Member";
}

export const DESCRIPTION_MAX = 500;
export const NAME_MIN = 2;
export const NAME_MAX = 80;
/** Mirrors convex/lib/validation.ts MAX_LOAN_DAYS (server stays authoritative). */
export const MAX_LOAN_DAYS = 30;

/** Presentation only: soft gradient + icon color per category (decorative placeholders). */
export const CATEGORY_STYLE: Record<Category, { gradient: string; icon: string }> = {
  power_tools: { gradient: "from-amber-100 to-orange-200", icon: "text-orange-900" },
  hand_tools: { gradient: "from-slate-100 to-slate-300", icon: "text-slate-800" },
  garden: { gradient: "from-lime-100 to-emerald-200", icon: "text-emerald-900" },
  kitchen: { gradient: "from-rose-100 to-orange-100", icon: "text-rose-900" },
  camping: { gradient: "from-teal-100 to-sky-200", icon: "text-teal-900" },
  cleaning: { gradient: "from-sky-100 to-cyan-200", icon: "text-sky-900" },
  sports: { gradient: "from-violet-100 to-fuchsia-200", icon: "text-violet-900" },
  other: { gradient: "from-zinc-100 to-stone-200", icon: "text-stone-800" },
};
