"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { ActionButton } from "@/components/ActionButton";
import { ActivityList } from "@/components/ActivityList";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge, Card, Empty, Loading, PageTitle } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { labelize } from "@/lib/constants";

export default function AdminPage() {
  const me = useQuery(api.users.me);
  if (me === undefined) return <Loading />;
  if (me === null || me.role !== "admin") {
    return <Empty>Not authorized: this page is for administrators only.</Empty>;
  }
  return <AdminDashboard />;
}

function AdminDashboard() {
  const loans = useQuery(api.admin.listAllLoans);
  const users = useQuery(api.admin.listUsers);
  const audit = useQuery(api.admin.auditLog);
  const tools = useQuery(api.tools.list, {});
  const recordViewed = useMutation(api.admin.recordLoansViewed);
  const removeTool = useMutation(api.admin.removeTool);
  const setTrusted = useMutation(api.admin.setTrustedLender);

  const recorded = useRef(false);
  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    void recordViewed().catch(() => {});
  }, [recordViewed]);

  return (
    <div className="space-y-10">
      <PageTitle>Admin</PageTitle>

      <section aria-labelledby="a-loans">
        <h2 id="a-loans" className="mb-3 text-lg font-semibold">All loans</h2>
        {loans === undefined ? <Loading /> : loans.length === 0 ? <Empty>No loans yet.</Empty> : (
          <ul className="grid gap-3">
            {loans.map((l) => (
              <li key={l._id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm"><span className="font-medium">{l.toolName}</span> · {l.borrowerName} borrowing from {l.ownerName} · {l.startDate} to {l.endDate}</p>
                    <StatusBadge status={l.status} />
                  </div>
                  <ActivityList activity={l.activity} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="a-tools">
        <h2 id="a-tools" className="mb-3 text-lg font-semibold">Listings</h2>
        {tools === undefined ? <Loading /> : tools.length === 0 ? <Empty>No listings.</Empty> : (
          <ul className="grid gap-2">
            {tools.map((t) => (
              <li key={t._id}>
                <Card className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm"><span className="font-medium">{t.name}</span> · {labelize(t.category)} · {t.owner.name}</span>
                  <div className="flex gap-2">
                    <ActionButton variant="danger" label="Remove" confirm={`Remove "${t.name}"? Active requests will be cancelled.`} action={() => removeTool({ toolId: t._id })} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="a-users">
        <h2 id="a-users" className="mb-3 text-lg font-semibold">Users</h2>
        {users === undefined ? <Loading /> : (
          <ul className="grid gap-2">
            {users.map((u) => (
              <li key={u._id}>
                <Card className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm">
                    <span className="font-medium">{u.name}</span>{" "}
                    {u.role === "admin" && <Badge tone="gray">admin</Badge>}{" "}
                    {u.trustedLender && <Badge tone="indigo">Trusted Lender</Badge>}
                  </span>
                  <div className="flex gap-2">
                    <ActionButton
                      label={u.trustedLender ? "Remove Trusted Lender" : "Make Trusted Lender"}
                      action={() => setTrusted({ userId: u._id, trusted: !u.trustedLender })}
                    />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="a-audit">
        <h2 id="a-audit" className="mb-3 text-lg font-semibold">Audit log</h2>
        {audit === undefined ? <Loading /> : audit.length === 0 ? <Empty>No audit entries.</Empty> : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Audit log</caption>
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-600">
                <tr>
                  <th scope="col" className="px-3 py-2">When</th>
                  <th scope="col" className="px-3 py-2">Actor</th>
                  <th scope="col" className="px-3 py-2">Action</th>
                  <th scope="col" className="px-3 py-2">Target</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((r) => (
                  <tr key={r._id} className="border-t border-zinc-100">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{r.actorName}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.targetType}:{r.targetId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
