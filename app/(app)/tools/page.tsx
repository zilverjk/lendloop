"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { BorrowForm } from "@/components/BorrowForm";
import { Badge, Card, Empty, Loading, PageTitle, inputClass } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CATEGORIES, firstName, labelize, type Category } from "@/lib/constants";

export default function ToolsPage() {
  const [category, setCategory] = useState<Category | "">("");
  const me = useQuery(api.users.me);
  const tools = useQuery(api.tools.list, category ? { category } : {});
  const [openId, setOpenId] = useState<Id<"tools"> | null>(null);

  return (
    <>
      <PageTitle action={<Link href="/tools/new" className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Lend a tool</Link>}>
        Browse tools
      </PageTitle>
      <div className="mb-4 max-w-xs">
        <label htmlFor="cat" className="mb-1 block text-sm font-medium">Category</label>
        <select id="cat" className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as Category | "")}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{labelize(c)}</option>)}
        </select>
      </div>
      {tools === undefined ? (
        <Loading />
      ) : tools.length === 0 ? (
        <Empty>No tools found.</Empty>
      ) : (
        <ul className="grid gap-3">
          {tools.map((t) => {
            const mine = me?._id === t.ownerId;
            return (
              <li key={t._id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-medium">{t.name}</h2>
                      <p className="mt-1 text-sm text-zinc-600">{t.description || "No description."}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                        <Badge>{labelize(t.category)}</Badge>
                        <span>Condition: {labelize(t.condition)}</span>
                        <span>Owner: {firstName(t.owner.name)}</span>
                        {t.owner.trustedLender && <Badge tone="indigo">Trusted Lender</Badge>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={t.isAvailable ? "green" : "amber"}>{t.isAvailable ? "Available" : "On loan"}</Badge>
                      {mine ? (
                        <Badge>Your tool</Badge>
                      ) : (
                        <button
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-indigo-600"
                          aria-expanded={openId === t._id}
                          onClick={() => setOpenId(openId === t._id ? null : t._id)}
                        >
                          Request to borrow
                        </button>
                      )}
                    </div>
                  </div>
                  {openId === t._id && <BorrowForm toolId={t._id} onDone={() => setOpenId(null)} />}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
