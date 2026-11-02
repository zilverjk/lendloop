"use client";

import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction } from "./useAction";
import { Button, ErrorText, Field, inputClass } from "./ui";

export function BorrowForm({ toolId, onDone }: { toolId: Id<"tools">; onDone: () => void }) {
  const request = useMutation(api.loans.request);
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const { pending, error, run } = useAction();
  const [done, setDone] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await request({ toolId, startDate: start, endDate: end });
      setDone(true);
    });
  }

  if (done) {
    return (
      <p role="status" className="mt-3 text-sm text-green-700">
        Request sent. Track it under My requests.{" "}
        <button className="underline" onClick={onDone}>Close</button>
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-md bg-zinc-50 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field label="From" htmlFor={`start-${toolId}`}>
        <input id={`start-${toolId}`} type="date" required min={today} className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
      <Field label="Until" htmlFor={`end-${toolId}`}>
        <input id={`end-${toolId}`} type="date" required min={start} className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send request"}</Button>
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
      </div>
      <div className="sm:col-span-3"><ErrorText message={error} /></div>
    </form>
  );
}
