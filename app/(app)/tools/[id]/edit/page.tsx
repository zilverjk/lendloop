"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { ToolForm } from "@/components/ToolForm";
import { Empty, Loading, PageTitle } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export default function EditToolPage() {
  const { id } = useParams<{ id: string }>();
  const toolId = id as Id<"tools">;
  const tool = useQuery(api.tools.get, { toolId });
  const update = useMutation(api.tools.update);
  const router = useRouter();

  if (tool === undefined) return <Loading />;
  if (tool === null) return <Empty>Tool not found.</Empty>;
  if (!tool.isOwner) return <Empty>Not authorized: only the owner can edit this listing.</Empty>;

  return (
    <>
      <PageTitle>Edit listing</PageTitle>
      <ToolForm
        submitLabel="Save changes"
        initial={{ name: tool.name, category: tool.category, condition: tool.condition, description: tool.description }}
        onSubmit={async (v) => {
          await update({ toolId, ...v });
          router.push("/me/listings");
        }}
      />
    </>
  );
}
