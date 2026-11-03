"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { ToolForm } from "@/components/ToolForm";
import { api } from "@/convex/_generated/api";

export default function NewToolPage() {
  const create = useMutation(api.tools.create);
  const router = useRouter();
  return (
    <>
      <PageHeader title="List a tool" description="Share something that is sitting idle. You approve every request." />
      <ToolForm
        submitLabel="Create listing"
        onSubmit={async (v) => {
          await create(v);
          router.push("/me/listings");
        }}
      />
    </>
  );
}
