"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Card, Empty, Loading, PageTitle } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { labelize } from "@/lib/constants";

export default function MyListingsPage() {
  const tools = useQuery(api.tools.myListings);
  const remove = useMutation(api.tools.remove);
  return (
    <>
      <PageTitle action={<Link href="/tools/new" className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">New listing</Link>}>
        My listings
      </PageTitle>
      {tools === undefined ? <Loading /> : tools.length === 0 ? <Empty>You have not listed any tools yet.</Empty> : (
        <ul className="grid gap-3">
          {tools.map((t) => (
            <li key={t._id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-medium">{t.name}</h2>
                    <p className="text-sm text-zinc-600">{labelize(t.category)} · {labelize(t.condition)}</p>
                  </div>
                  <Badge tone={t.isAvailable ? "green" : "amber"}>{t.isAvailable ? "Available" : "On loan"}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/tools/${t._id}/edit`} className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-indigo-600">Edit</Link>
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
