"use client";

import { useState, type FormEvent } from "react";
import {
  CATEGORIES,
  CONDITIONS,
  DESCRIPTION_MAX,
  NAME_MAX,
  NAME_MIN,
  labelize,
  type Category,
  type Condition,
} from "@/lib/constants";
import { useAction } from "./useAction";
import { Button, Card, ErrorText, Field, Input, Select, Textarea } from "./ui";

export type ToolFormValues = { name: string; category: Category; condition: Condition; description: string };

type Errors = Partial<Record<"name" | "description", string>>;

/** Mirrors convex/lib/validation.ts; the server stays authoritative. */
function validate(v: ToolFormValues): Errors {
  const e: Errors = {};
  const name = v.name.trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) e.name = `Name must be ${NAME_MIN}-${NAME_MAX} characters.`;
  if (v.description.trim().length > DESCRIPTION_MAX) e.description = `Description must be at most ${DESCRIPTION_MAX} characters.`;
  return e;
}

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
  const [touched, setTouched] = useState<{ name?: boolean; description?: boolean }>({});
  const [submitted, setSubmitted] = useState(false);
  const { pending, error, run } = useAction();

  const errors = validate(v);
  const show = (k: "name" | "description") => (submitted || touched[k] ? (errors[k] ?? null) : null);

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) {
      document.getElementById(errors.name ? "name" : "description")?.focus();
      return;
    }
    void run(() => onSubmit(v));
  }

  return (
    <form onSubmit={submit} noValidate>
      <Card className="space-y-5">
        <p className="text-sm text-muted">
          Fields marked <span aria-hidden className="text-danger-600">*</span>
          <span className="sr-only">with an asterisk</span> are required.
        </p>
        <Field label="Name" id="name" required hint={`${NAME_MIN} to ${NAME_MAX} characters. Example: Cordless drill`} error={show("name")}>
          {(p) => (
            <Input
              {...p}
              required
              maxLength={NAME_MAX}
              autoComplete="off"
              value={v.name}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              onChange={(e) => setV({ ...v, name: e.target.value })}
            />
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" id="category" required>
            {(p) => (
              <Select {...p} value={v.category} onChange={(e) => setV({ ...v, category: e.target.value as Category })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {labelize(c)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Condition" id="condition" required>
            {(p) => (
              <Select {...p} value={v.condition} onChange={(e) => setV({ ...v, condition: e.target.value as Condition })}>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {labelize(c)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field
          label="Description"
          id="description"
          error={show("description")}
          hint={
            <>
              Tell borrowers what it is good for and anything to know before using it.{" "}
              <span aria-live="polite">
                {v.description.length}/{DESCRIPTION_MAX}
              </span>
            </>
          }
        >
          {(p) => (
            <Textarea
              {...p}
              rows={5}
              value={v.description}
              onBlur={() => setTouched((t) => ({ ...t, description: true }))}
              onChange={(e) => setV({ ...v, description: e.target.value })}
            />
          )}
        </Field>
        <div>
          <Button type="submit" loading={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
          <ErrorText message={error} />
        </div>
      </Card>
    </form>
  );
}
