"use client";

import { useQuery } from "convex/react";
import { PackageSearch, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { ToolCard } from "@/components/ToolCard";
import { Button, buttonClass, EmptyState, FilterChip, Loading, PageHeader } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { ViewToggle } from "@/components/ViewToggle";
import { buildBrowseQuery, parseCategory, parseView, VIEW_STORAGE_KEY, type BrowseView } from "@/lib/view";
import { CATEGORIES, labelize, type Category } from "@/lib/constants";

export default function ToolsPage() {
  return (
    <Suspense fallback={<Loading label="Loading tools…" rows={4} />}>
      <Browse />
    </Suspense>
  );
}

function Browse() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const category = parseCategory(params.get("category"));
  const view = parseView(params.get("view"));
  const go = (next: { view: BrowseView; category: Category | "" }) => router.replace(`${pathname}${buildBrowseQuery(next)}`, { scroll: false });
  const setCategory = (c: Category | "") => go({ view, category: c });
  const setView = (v: BrowseView) => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {}
    go({ view: v, category });
  };
  // Fall back to the remembered view when the URL has none.
  useEffect(() => {
    if (params.get("view")) return;
    try {
      if (localStorage.getItem(VIEW_STORAGE_KEY) === "list") router.replace(`${pathname}${buildBrowseQuery({ view: "list", category })}`, { scroll: false });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const me = useQuery(api.users.me);
  const tools = useQuery(api.tools.list, category ? { category } : {});

  return (
    <>
      <PageHeader
        title="Browse tools"
        description="Find something nearby and request the dates you need."
        action={
          <Link href="/tools/new" className={buttonClass()}>
            <Plus aria-hidden className="size-4" />
            List a tool
          </Link>
        }
      />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
          <FilterChip selected={category === ""} onClick={() => setCategory("")}>
            All
          </FilterChip>
          {CATEGORIES.map((c) => (
            <FilterChip key={c} selected={category === c} onClick={() => setCategory(c)}>
              {labelize(c)}
            </FilterChip>
          ))}
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>
      <div aria-live="polite">
        {tools === undefined ? (
          <Loading label="Loading tools…" rows={4} />
        ) : tools.length === 0 ? (
          <EmptyState
            icon={<PackageSearch aria-hidden />}
            title="No tools found"
            action={
              category ? (
                <Button variant="secondary" onClick={() => setCategory("")}>
                  Clear filter
                </Button>
              ) : (
                <Link href="/tools/new" className={buttonClass()}>
                  List the first tool
                </Link>
              )
            }
          >
            {category ? `Nothing is listed under ${labelize(category)} yet.` : "Nobody has listed a tool yet. Be the first."}
          </EmptyState>
        ) : (
          <ul className={view === "grid" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-4"}>
            {tools.map((t) => (
              <li key={t._id}>
                <ToolCard tool={t} mine={me?._id === t.ownerId} view={view} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
