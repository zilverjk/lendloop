"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { labelize } from "@/lib/constants";
import type { BrowseView } from "@/lib/view";
import type { Id } from "@/convex/_generated/dataModel";
import { BorrowForm } from "./BorrowForm";
import { CategoryThumb } from "./CategoryThumb";
import { Badge, Button, Card, Chip } from "./ui";

export type BrowseTool = {
  _id: Id<"tools">;
  name: string;
  description?: string;
  category: string;
  condition: string;
  isAvailable: boolean;
  owner: { firstName: string; trustedLender?: boolean };
};

export function ToolCard({ tool: t, mine, view }: { tool: BrowseTool; mine: boolean; view: BrowseView }) {
  const [open, setOpen] = useState(false);
  const formId = `borrow-${t._id}`;
  const status = <Badge tone={t.isAvailable ? "green" : "amber"}>{t.isAvailable ? "Available" : "On loan"}</Badge>;
  const trusted = t.owner.trustedLender && (
    <Badge tone="brand" icon={<ShieldCheck aria-hidden className="size-3.5" />}>
      Trusted Lender
    </Badge>
  );
  const cta = mine ? (
    <Badge>Your tool</Badge>
  ) : (
    <Button variant="secondary" size="sm" aria-expanded={open} aria-controls={formId} onClick={() => setOpen(!open)}>
      Request to borrow
    </Button>
  );
  const form = open && (
    <div id={formId}>
      <BorrowForm toolId={t._id} onDone={() => setOpen(false)} />
    </div>
  );

  if (view === "grid") {
    return (
      <Card className="flex h-full flex-col transition-shadow hover:shadow-pop">
        <CategoryThumb category={t.category} className="h-28 w-full" />
        <div className="mt-4 flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold">{t.name}</h2>
          {status}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Chip>{labelize(t.category)}</Chip>
          {trusted}
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-muted">{t.description || "No description."}</p>
        <p className="mt-2 text-sm text-muted">Owner: {t.owner.firstName}</p>
        <div className="mt-auto flex justify-end pt-4">{cta}</div>
        {form}
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row">
        <CategoryThumb category={t.category} className="size-20" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-base font-semibold">{t.name}</h2>
            {status}
          </div>
          <p className="mt-1 text-sm text-muted">{t.description || "No description."}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
            <Chip>{labelize(t.category)}</Chip>
            <span>Condition: {labelize(t.condition)}</span>
            <span>Owner: {t.owner.firstName}</span>
            {trusted}
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end">{cta}</div>
      {form}
    </Card>
  );
}
