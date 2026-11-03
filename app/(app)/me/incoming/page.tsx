"use client";

import { useMutation, useQuery } from "convex/react";
import { Inbox } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { LoanCard } from "@/components/LoanCard";
import { EmptyState, Loading, PageHeader } from "@/components/ui";
import { api } from "@/convex/_generated/api";

export default function IncomingPage() {
  const loans = useQuery(api.loans.incomingRequests);
  const approve = useMutation(api.loans.approve);
  const decline = useMutation(api.loans.decline);
  const markReturned = useMutation(api.loans.markReturned);
  return (
    <>
      <PageHeader title="Incoming requests" description="Neighbors asking to borrow your tools." />
      {loans === undefined ? (
        <Loading label="Loading incoming requests…" />
      ) : loans.length === 0 ? (
        <EmptyState icon={<Inbox aria-hidden />} title="No requests yet">
          When someone asks to borrow one of your tools, it will show up here.
        </EmptyState>
      ) : (
        <ul className="grid gap-4">
          {loans.map((l) => (
            <li key={l._id}>
              <LoanCard loan={l} counterpartyLabel="Borrower">
                {l.status === "pending" && (
                  <>
                    <ActionButton label="Approve" variant="primary" action={() => approve({ loanId: l._id })} />
                    <ActionButton label="Decline" action={() => decline({ loanId: l._id })} />
                  </>
                )}
                {l.status === "approved" && <ActionButton label="Mark returned" variant="primary" action={() => markReturned({ loanId: l._id })} />}
              </LoanCard>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
