"use client";

import { CalendarDays } from "lucide-react";
import type { ReactNode } from "react";
import type { ActivityKind } from "@/lib/time";
import { ActivityList } from "./ActivityList";
import { StatusBadge } from "./StatusBadge";
import { Card } from "./ui";

export type LoanView = {
  toolName: string;
  status: "pending" | "approved" | "declined" | "returned" | "cancelled";
  startDate: string;
  endDate: string;
  counterpartyName: string;
  activity: { kind: ActivityKind; createdAt: number }[];
};

export function LoanCard({ loan, counterpartyLabel, children }: { loan: LoanView; counterpartyLabel: string; children?: ReactNode }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{loan.toolName}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {counterpartyLabel}: <span className="font-medium text-ink">{loan.counterpartyName}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <CalendarDays aria-hidden className="size-4" />
            <time dateTime={loan.startDate}>{loan.startDate}</time> to <time dateTime={loan.endDate}>{loan.endDate}</time>
          </p>
        </div>
        <StatusBadge status={loan.status} endDate={loan.endDate} />
      </div>
      <ActivityList activity={loan.activity} />
      {children && <div className="mt-4 flex flex-wrap gap-2">{children}</div>}
    </Card>
  );
}
