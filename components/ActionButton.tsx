"use client";

import { useAction } from "./useAction";
import { Button, ErrorText } from "./ui";

export function ActionButton({
  label,
  action,
  variant = "secondary",
  confirm,
}: {
  label: string;
  action: () => Promise<unknown>;
  variant?: "primary" | "secondary" | "danger";
  confirm?: string;
}) {
  const { pending, error, run } = useAction();
  return (
    <>
      <Button
        variant={variant}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          void run(action);
        }}
      >
        {pending ? "Working…" : label}
      </Button>
      {error && <div className="basis-full"><ErrorText message={error} /></div>}
    </>
  );
}
