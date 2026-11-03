"use client";

import { useQuery } from "convex/react";
import { PackageSearch } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { labelize } from "@/lib/constants";
import { CategoryThumb } from "./CategoryThumb";
import { Chip, EmptyState, Loading } from "./ui";

export function PublicTools() {
  const tools = useQuery(api.tools.listPublic);
  if (tools === undefined) return <Loading label="Loading available tools…" variant="grid" rows={6} />;
  if (tools.length === 0) {
    return (
      <EmptyState icon={<PackageSearch aria-hidden />} title="Nothing on the shelf yet">
        No tools are available right now. Check back soon, or be the first to list one.
      </EmptyState>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((t) => (
        <li key={t._id} className="flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card">
          <CategoryThumb category={t.category} className="size-14" />
          <div className="min-w-0">
            <p className="line-clamp-2 font-semibold text-ink">{t.name}</p>
            <div className="mt-1.5">
              <Chip>{labelize(t.category)}</Chip>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
