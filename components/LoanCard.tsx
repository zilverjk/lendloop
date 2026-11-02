"use client";

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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-medium">{loan.toolName}</h2>
          <p className="text-sm text-zinc-600">
            {counterpartyLabel}: {loan.counterpartyName} · {loan.startDate} to {loan.endDate}
          </p>
        </div>
        <StatusBadge status={loan.status} />
      </div>
      <ActivityList activity={loan.activity} />
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </Card>
  );
}
