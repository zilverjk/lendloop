import { CookingPot, Dumbbell, Drill, Hammer, Package, SprayCan, Sprout, Tent, type LucideIcon } from "lucide-react";
import { CATEGORY_STYLE, type Category } from "@/lib/constants";

const ICONS: Record<Category, LucideIcon> = {
  power_tools: Drill,
  hand_tools: Hammer,
  garden: Sprout,
  kitchen: CookingPot,
  camping: Tent,
  cleaning: SprayCan,
  sports: Dumbbell,
  other: Package,
};

/** Decorative per-category placeholder: lucide icon on a soft gradient. */
export function CategoryThumb({ category, className = "size-16" }: { category: string; className?: string }) {
  const key = (category in ICONS ? category : "other") as Category;
  const Icon = ICONS[key];
  const s = CATEGORY_STYLE[key];
  return (
    <div aria-hidden className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${s.gradient} ${className}`}>
      <Icon className={`size-1/2 ${s.icon}`} strokeWidth={1.75} />
    </div>
  );
}
