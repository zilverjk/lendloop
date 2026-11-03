"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/ActionButton";
import { ActivityList } from "@/components/ActivityList";
import { StatusBadge } from "@/components/StatusBadge";
import { Lock, ShieldCheck } from "lucide-react";
import { Alert, Badge, Card, EmptyState, Loading, PageHeader, SectionHeading } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { labelize } from "@/lib/constants";

export default function AdminPage() {
  const me = useQuery(api.users.me);
  if (me === undefined) return <Loading label="Checking access…" rows={1} />;
  if (me === null || me.role !== "admin") {
    return (
      <EmptyState icon={<Lock aria-hidden />} title="Not authorized">
        This page is for administrators only.
      </EmptyState>
    );
  }
  return <AdminDashboard />;
}

function AdminDashboard() {
  const users = useQuery(api.admin.listUsers);
  const audit = useQuery(api.admin.auditLog);
  const tools = useQuery(api.tools.list, {});
  const listAllLoans = useMutation(api.admin.listAllLoans);
  const removeTool = useMutation(api.admin.removeTool);
  const setTrusted = useMutation(api.admin.setTrustedLender);

  // Listing all loans is a mutation: the server writes the audit row as part of the call.
  const [loans, setLoans] = useState<Awaited<ReturnType<typeof listAllLoans>> | undefined>();
  const [loansError, setLoansError] = useState(false);
  const loadLoans = useCallback(async () => {
    setLoansError(false);
    try {
      setLoans(await listAllLoans());
    } catch {
      setLoansError(true);
    }
  }, [listAllLoans]);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void loadLoans();
  }, [loadLoans]);

  return (
    <div className="space-y-12">
      <PageHeader title="Admin" description="Moderate listings, trusted lenders and review activity." />

      <section aria-labelledby="a-loans">
        <SectionHeading id="a-loans" action={<ActionButton label="Refresh" action={loadLoans} />}>
          All loans
        </SectionHeading>
        {loansError ? (
          <Alert tone="error">Could not load loans. Try Refresh.</Alert>
        ) : loans === undefined ? (
          <Loading label="Loading loans…" rows={2} />
        ) : loans.length === 0 ? (
          <EmptyState title="No loans yet">Requests will appear here once neighbors start borrowing.</EmptyState>
        ) : (
          <ul className="grid gap-3">
            {loans.map((l) => (
              <li key={l._id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm text-muted">
                      <span className="font-semibold text-ink">{l.toolName}</span> · {l.borrowerName} borrowing from {l.ownerName} · {l.startDate} to {l.endDate}
                    </p>
                    <StatusBadge status={l.status} endDate={l.endDate} />
                  </div>
                  <ActivityList activity={l.activity} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="a-tools">
        <SectionHeading id="a-tools">Listings</SectionHeading>
        {tools === undefined ? (
          <Loading label="Loading listings…" rows={2} />
        ) : tools.length === 0 ? (
          <EmptyState title="No listings">Nothing has been listed yet.</EmptyState>
        ) : (
          <ul className="grid gap-3">
            {tools.map((t) => (
              <li key={t._id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 !p-4">
                  <span className="text-sm text-muted">
                    <span className="font-semibold text-ink">{t.name}</span> · {labelize(t.category)} · {t.owner.firstName}
                  </span>
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
        <SectionHeading id="a-users">Users</SectionHeading>
        {users === undefined ? (
          <Loading label="Loading users…" rows={2} />
        ) : (
          <ul className="grid gap-3">
            {users.map((u) => (
              <li key={u._id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 !p-4">
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">{u.name}</span>
                    {u.role === "admin" && <Badge tone="gray">Admin</Badge>}
                    {u.trustedLender && (
                      <Badge tone="brand" icon={<ShieldCheck aria-hidden className="size-3.5" />}>
                        Trusted Lender
                      </Badge>
                    )}
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
        <SectionHeading id="a-audit">Audit log</SectionHeading>
        {audit === undefined ? (
          <Loading label="Loading audit log…" rows={2} />
        ) : audit.length === 0 ? (
          <EmptyState title="No audit entries">Admin actions will be recorded here.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card" tabIndex={0} role="region" aria-label="Audit log table, scrollable">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <caption className="sr-only">Audit log</caption>
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">When</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Actor</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Action</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {audit.map((r) => (
                  <tr key={r._id}>
                    <td className="whitespace-nowrap px-4 py-3">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">{r.actorName}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.action}</td>
                    <td className="break-all px-4 py-3 font-mono text-xs">{r.targetType}:{r.targetId}</td>
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
