"use client";

import { useMutation, useQuery } from "convex/react";
import { ActionButton } from "@/components/ActionButton";
import { LoanCard } from "@/components/LoanCard";
import { Empty, Loading, PageTitle } from "@/components/ui";
import { api } from "@/convex/_generated/api";

export default function IncomingPage() {
  const loans = useQuery(api.loans.incomingRequests);
  const approve = useMutation(api.loans.approve);
  const decline = useMutation(api.loans.decline);
  const markReturned = useMutation(api.loans.markReturned);
  return (
    <>
      <PageTitle>Incoming requests</PageTitle>
      {loans === undefined ? <Loading /> : loans.length === 0 ? <Empty>No one has requested your tools yet.</Empty> : (
        <ul className="grid gap-3">
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
