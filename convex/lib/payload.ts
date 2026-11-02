/** Data-minimization builders for everything that leaves Convex. */

export type OutboundType =
  | "loan.requested"
  | "loan.approved"
  | "loan.declined"
  | "loan.returned"
  | "loan.cancelled";

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "there";
}

export type LoanEventInput = {
  eventId: string;
  type: OutboundType;
  occurredAt: number;
  loan: { _id: string; status: string; startDate: string; endDate: string };
  tool: { name: string };
  owner: { name: string; email: string };
  borrower: { name: string; email: string };
};

export type LoanEventPayload = {
  eventId: string;
  type: OutboundType;
  occurredAt: string;
  loan: { id: string; status: string; startDate: string; endDate: string };
  tool: { name: string };
  recipient: { email: string; firstName: string };
  counterparty: { firstName: string };
};

/** Recipient is the owner for requested/cancelled, the borrower otherwise. */
export function buildLoanEventPayload(i: LoanEventInput): LoanEventPayload {
  const toOwner = i.type === "loan.requested" || i.type === "loan.cancelled";
  const recipient = toOwner ? i.owner : i.borrower;
  const counterparty = toOwner ? i.borrower : i.owner;
  return {
    eventId: i.eventId,
    type: i.type,
    occurredAt: new Date(i.occurredAt).toISOString(),
    loan: {
      id: i.loan._id,
      status: i.loan.status,
      startDate: i.loan.startDate,
      endDate: i.loan.endDate,
    },
    tool: { name: i.tool.name },
    recipient: { email: recipient.email, firstName: firstName(recipient.name) },
    counterparty: { firstName: firstName(counterparty.name) },
  };
}

export type OverdueItem = {
  loanId: string;
  endDate: string;
  daysOverdue: number;
  tool: { name: string };
  borrower: { email: string; firstName: string };
};

export function buildOverdueItem(
  loan: { _id: string; endDate: string },
  daysOverdue: number,
  tool: { name: string },
  borrower: { name: string; email: string },
): OverdueItem {
  return {
    loanId: loan._id,
    endDate: loan.endDate,
    daysOverdue,
    tool: { name: tool.name },
    borrower: { email: borrower.email, firstName: firstName(borrower.name) },
  };
}
