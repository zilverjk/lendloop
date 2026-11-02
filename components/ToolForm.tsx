"use client";

import { useState, type FormEvent } from "react";
import { CATEGORIES, CONDITIONS, DESCRIPTION_MAX, labelize, type Category, type Condition } from "@/lib/constants";
import { useAction } from "./useAction";
import { Button, ErrorText, Field, inputClass } from "./ui";

export type ToolFormValues = { name: string; category: Category; condition: Condition; description: string };

export function ToolForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: ToolFormValues;
  submitLabel: string;
  onSubmit: (v: ToolFormValues) => Promise<unknown>;
}) {
  const [v, setV] = useState<ToolFormValues>(initial ?? { name: "", category: "hand_tools", condition: "good", description: "" });
  const { pending, error, run } = useAction();

  function submit(e: FormEvent) {
    e.preventDefault();
    void run(() => onSubmit(v));
  }

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4">
      <Field label="Name" htmlFor="name" hint="2 to 80 characters">
        <input id="name" required minLength={2} maxLength={80} className={inputClass} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </Field>
      <Field label="Category" htmlFor="category">
        <select id="category" className={inputClass} value={v.category} onChange={(e) => setV({ ...v, category: e.target.value as Category })}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{labelize(c)}</option>
          ))}
        </select>
      </Field>
      <Field label="Condition" htmlFor="condition">
        <select id="condition" className={inputClass} value={v.condition} onChange={(e) => setV({ ...v, condition: e.target.value as Condition })}>
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>{labelize(c)}</option>
          ))}
        </select>
      </Field>
      <Field
        label="Description"
        htmlFor="description"
        hint={<span aria-live="polite">{v.description.length}/{DESCRIPTION_MAX}</span>}
      >
        <textarea id="description" rows={4} maxLength={DESCRIPTION_MAX} className={inputClass} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
      <ErrorText message={error} />
    </form>
  );
}
