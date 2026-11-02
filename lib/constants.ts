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
