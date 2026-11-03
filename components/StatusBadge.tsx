import { Ban, CircleCheck, CircleX, Clock, PackageCheck, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "./ui";

const icon = "size-3.5";
const config = {
  pending: { tone: "amber", label: "Pending", icon: <Clock aria-hidden className={icon} /> },
  approved: { tone: "green", label: "Approved", icon: <CircleCheck aria-hidden className={icon} /> },
  declined: { tone: "red", label: "Declined", icon: <CircleX aria-hidden className={icon} /> },
  returned: { tone: "gray", label: "Returned", icon: <PackageCheck aria-hidden className={icon} /> },
  cancelled: { tone: "gray", label: "Cancelled", icon: <Ban aria-hidden className={icon} /> },
  overdue: { tone: "red", label: "Overdue", icon: <TriangleAlert aria-hidden className={icon} /> },
} as const satisfies Record<string, { tone: "amber" | "green" | "red" | "gray"; label: string; icon: ReactNode }>;

export type LoanStatus = "pending" | "approved" | "declined" | "returned" | "cancelled";

/** Display status; an approved loan whose end date has passed is shown as overdue (presentation only). */
export function displayStatus(status: LoanStatus, endDate?: string, today: string = new Date().toISOString().slice(0, 10)): keyof typeof config {
  return status === "approved" && endDate !== undefined && endDate < today ? "overdue" : status;
}

export function StatusBadge({ status, endDate }: { status: LoanStatus; endDate?: string }) {
  const c = config[displayStatus(status, endDate)];
  return (
    <Badge tone={c.tone} icon={c.icon}>
      {c.label}
    </Badge>
  );
}
