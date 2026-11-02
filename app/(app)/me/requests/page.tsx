"use client";

import { useMutation, useQuery } from "convex/react";
import { ActionButton } from "@/components/ActionButton";
import { LoanCard } from "@/components/LoanCard";
import { Empty, Loading, PageTitle } from "@/components/ui";
import { api } from "@/convex/_generated/api";

export default function MyRequestsPage() {
  const loans = useQuery(api.loans.myRequests);
  const cancel = useMutation(api.loans.cancel);
  const markReturned = useMutation(api.loans.markReturned);
  return (
    <>
      <PageTitle>My requests</PageTitle>
      {loans === undefined ? <Loading /> : loans.length === 0 ? <Empty>You have not requested any tools.</Empty> : (
        <ul className="grid gap-3">
          {loans.map((l) => (
            <li key={l._id}>
              <LoanCard loan={l} counterpartyLabel="Owner">
                {l.status === "pending" && <ActionButton label="Cancel request" action={() => cancel({ loanId: l._id })} />}
                {l.status === "approved" && <ActionButton label="Mark returned" variant="primary" action={() => markReturned({ loanId: l._id })} />}
              </LoanCard>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
