"use client";

import { useQuery } from "convex/react";
import { PackageSearch, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BorrowForm } from "@/components/BorrowForm";
import { CategoryThumb } from "@/components/CategoryThumb";
import { Badge, Button, buttonClass, Card, Chip, EmptyState, FilterChip, Loading, PageHeader } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CATEGORIES, labelize, type Category } from "@/lib/constants";

export default function ToolsPage() {
  const [category, setCategory] = useState<Category | "">("");
  const me = useQuery(api.users.me);
  const tools = useQuery(api.tools.list, category ? { category } : {});
  const [openId, setOpenId] = useState<Id<"tools"> | null>(null);

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
      <div role="group" aria-label="Filter by category" className="mb-6 flex flex-wrap gap-2">
        <FilterChip selected={category === ""} onClick={() => setCategory("")}>
          All
        </FilterChip>
        {CATEGORIES.map((c) => (
          <FilterChip key={c} selected={category === c} onClick={() => setCategory(c)}>
            {labelize(c)}
          </FilterChip>
        ))}
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
          <ul className="grid gap-4">
            {tools.map((t) => {
              const mine = me?._id === t.ownerId;
              const formId = `borrow-${t._id}`;
              return (
                <li key={t._id}>
                  <Card>
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <CategoryThumb category={t.category} className="size-20" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h2 className="text-base font-semibold">{t.name}</h2>
                          <Badge tone={t.isAvailable ? "green" : "amber"}>{t.isAvailable ? "Available" : "On loan"}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted">{t.description || "No description."}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
                          <Chip>{labelize(t.category)}</Chip>
                          <span>Condition: {labelize(t.condition)}</span>
                          <span>Owner: {t.owner.firstName}</span>
                          {t.owner.trustedLender && (
                            <Badge tone="brand" icon={<ShieldCheck aria-hidden className="size-3.5" />}>
                              Trusted Lender
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      {mine ? (
                        <Badge>Your tool</Badge>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-expanded={openId === t._id}
                          aria-controls={formId}
                          onClick={() => setOpenId(openId === t._id ? null : t._id)}
                        >
                          Request to borrow
                        </Button>
                      )}
                    </div>
                    {openId === t._id && (
                      <div id={formId}>
                        <BorrowForm toolId={t._id} onDone={() => setOpenId(null)} />
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
