"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { ToolForm } from "@/components/ToolForm";
import { api } from "@/convex/_generated/api";

export default function NewToolPage() {
  const create = useMutation(api.tools.create);
  const router = useRouter();
  return (
    <>
      <PageTitle>Lend a tool</PageTitle>
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
