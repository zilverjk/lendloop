"use client";

import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { MAX_LOAN_DAYS } from "@/lib/constants";
import { useAction } from "./useAction";
import { Alert, Button, ErrorText, Field, Input } from "./ui";

type Errors = { start?: string; end?: string };

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Mirrors convex/lib/validation.ts validateLoanDates; the server stays authoritative. */
function validate(start: string, end: string, today: string): Errors {
  const e: Errors = {};
  if (!start) e.start = "Choose a start date.";
  else if (start < today) e.start = "Start date cannot be in the past.";
  if (!end) e.end = "Choose an end date.";
  else if (start && end < start) e.end = "End date must not be before the start date.";
  else if (start && daysBetween(start, end) > MAX_LOAN_DAYS) e.end = `Loans are limited to ${MAX_LOAN_DAYS} days.`;
  return e;
}

export function BorrowForm({ toolId, onDone }: { toolId: Id<"tools">; onDone: () => void }) {
  const request = useMutation(api.loans.request);
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const { pending, error, run } = useAction();
  const [done, setDone] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const errors = validate(start, end, today);

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (errors.start || errors.end) return;
    void run(async () => {
      await request({ toolId, startDate: start, endDate: end });
      setDone(true);
    });
  }

  if (done) {
    return (
      <Alert tone="success" className="mt-4">
        <p>Request sent. Track it under My requests.</p>
        <button type="button" className="mt-1 font-medium underline underline-offset-2" onClick={onDone}>
          Close
        </button>
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Request to borrow" className="mt-4 rounded-xl bg-surface-muted p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From" id={`start-${toolId}`} required error={submitted ? (errors.start ?? null) : null}>
          {(p) => <Input {...p} type="date" required min={today} value={start} onChange={(e) => setStart(e.target.value)} />}
        </Field>
        <Field label="Until" id={`end-${toolId}`} required hint={`Up to ${MAX_LOAN_DAYS} days.`} error={submitted ? (errors.end ?? null) : null}>
          {(p) => <Input {...p} type="date" required min={start || today} value={end} onChange={(e) => setEnd(e.target.value)} />}
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          {pending ? "Sending…" : "Send request"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
      </div>
      <ErrorText message={error} />
    </form>
  );
}
