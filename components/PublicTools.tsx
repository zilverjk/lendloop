"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { labelize } from "@/lib/constants";
import { Badge, Empty, Loading } from "./ui";

export function PublicTools() {
  const tools = useQuery(api.tools.listPublic);
  if (tools === undefined) return <Loading label="Loading available tools…" />;
  if (tools.length === 0) return <Empty>No tools are available right now.</Empty>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {tools.map((t) => (
        <li key={t._id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3">
          <span className="font-medium">{t.name}</span>
          <Badge>{labelize(t.category)}</Badge>
        </li>
      ))}
    </ul>
  );
}
