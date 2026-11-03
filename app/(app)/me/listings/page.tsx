"use client";

import { useMutation, useQuery } from "convex/react";
import { PackagePlus, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import { CategoryThumb } from "@/components/CategoryThumb";
import { Badge, buttonClass, Card, Chip, EmptyState, Loading, PageHeader } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { labelize } from "@/lib/constants";

export default function MyListingsPage() {
  const tools = useQuery(api.tools.myListings);
  const remove = useMutation(api.tools.remove);
  return (
    <>
      <PageHeader
        title="My listings"
        description="Tools you are lending to the neighborhood."
        action={
          <Link href="/tools/new" className={buttonClass()}>
            <Plus aria-hidden className="size-4" />
            New listing
          </Link>
        }
      />
      {tools === undefined ? (
        <Loading label="Loading your listings…" />
      ) : tools.length === 0 ? (
        <EmptyState
          icon={<PackagePlus aria-hidden />}
          title="You have not listed any tools yet"
          action={
            <Link href="/tools/new" className={buttonClass()}>
              List your first tool
            </Link>
          }
        >
          Got a drill, ladder or camp stove gathering dust? Put it to work.
        </EmptyState>
      ) : (
        <ul className="grid gap-4">
          {tools.map((t) => (
            <li key={t._id}>
              <Card>
                <div className="flex gap-4">
                  <CategoryThumb category={t.category} className="size-16" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="text-base font-semibold">{t.name}</h2>
                      <Badge tone={t.isAvailable ? "green" : "amber"}>{t.isAvailable ? "Available" : "On loan"}</Badge>
                    </div>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                      <Chip>{labelize(t.category)}</Chip>
                      <span>Condition: {labelize(t.condition)}</span>
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/tools/${t._id}/edit`} className={buttonClass({ variant: "secondary", size: "sm" })}>
                    <Pencil aria-hidden className="size-3.5" />
                    Edit
                    <span className="sr-only"> {t.name}</span>
                  </Link>
                  <ActionButton variant="danger" label="Delete" confirm={`Delete "${t.name}"?`} action={() => remove({ toolId: t._id })} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
