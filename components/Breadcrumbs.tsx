import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Crumb } from "@/lib/nav";

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1">
              {last || !c.href ? (
                <span aria-current={last ? "page" : undefined} className={last ? "font-medium text-ink" : undefined}>
                  {c.label}
                </span>
              ) : (
                <Link href={c.href} className="rounded underline-offset-2 hover:text-ink hover:underline">
                  {c.label}
                </Link>
              )}
              {!last && <ChevronRight aria-hidden className="size-4" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
