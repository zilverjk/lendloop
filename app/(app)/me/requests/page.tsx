"use client";

import { useMutation, useQuery } from "convex/react";
import { Send } from "lucide-react";
import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import { LoanCard } from "@/components/LoanCard";
import { buttonClass, EmptyState, Loading, PageHeader } from "@/components/ui";
import { api } from "@/convex/_generated/api";

export default function MyRequestsPage() {
  const loans = useQuery(api.loans.myRequests);
  const cancel = useMutation(api.loans.cancel);
  const markReturned = useMutation(api.loans.markReturned);
  return (
    <>
      <PageHeader title="My requests" description="Tools you have asked to borrow, and where each request stands." />
      {loans === undefined ? (
        <Loading label="Loading your requests…" />
      ) : loans.length === 0 ? (
        <EmptyState
          icon={<Send aria-hidden />}
          title="You have not requested any tools"
          action={
            <Link href="/tools" className={buttonClass()}>
              Browse tools
            </Link>
          }
        >
          Find something you need and pick the dates.
        </EmptyState>
      ) : (
        <ul className="grid gap-4">
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
