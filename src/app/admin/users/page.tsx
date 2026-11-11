"use client";

import * as React from "react";
import { Download, Search, ShieldCheck, UserRound, UserRoundX } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { AdminError, AdminPagination, adminRequest, downloadCsv, formatAdminDate, useAdminResource } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { DemoDataBadge } from "@/components/ui/data-source";

type Account = {
  id: string;
  name: string;
  email: string;
  role: "PATIENT" | "HOSPITAL_ADMIN" | "SUPER_ADMIN";
  status: string;
  phone: string | null;
  isDemo: boolean;
  hospitalId: string | null;
  hospital: { name: string; status: string } | null;
  emailVerifiedAt: string | null;
  createdAt: string;
};
type AccountResponse = { users: Account[]; total: number; page: number; pageSize: number };

const pageSize = 50;
const roles = ["", "PATIENT", "HOSPITAL_ADMIN", "SUPER_ADMIN"];
const statuses = ["", "ACTIVE", "PENDING_VERIFICATION", "SUSPENDED"];

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [draft, setDraft] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [role, setRole] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [target, setTarget] = React.useState<Account | null>(null);
  const [busy, setBusy] = React.useState(false);
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (query) params.set("q", query);
  if (role) params.set("role", role);
  if (status) params.set("status", status);
  const url = `/api/admin/users?${params.toString()}`;
  const resource = useAdminResource<AccountResponse>(url);
  const accounts = resource.data?.users ?? [];

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draft.trim());
    setPage(1);
  }

  async function setAccountStatus() {
    if (!target) return;
    const nextStatus = target.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    setBusy(true);
    try {
      await adminRequest<{ user: Pick<Account, "id" | "status"> }>("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ userId: target.id, status: nextStatus }),
      });
      toast({
        title: nextStatus === "SUSPENDED" ? "Account suspended" : "Account reactivated",
        description: nextStatus === "SUSPENDED" ? "The change is recorded in the audit trail and existing sessions have been revoked." : "The account can sign in again. The change is recorded in the audit trail.",
        variant: "success",
      });
      setTarget(null);
      await resource.refresh();
    } catch (cause) {
      toast({ title: "Account was not changed", description: cause instanceof Error ? cause.message : "The request could not be completed.", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  function exportPage() {
    downloadCsv(`accounts-page-${page}-${new Date().toISOString().slice(0, 10)}.csv`, ["Name", "Email", "Role", "Status", "Demo data", "Phone", "Hospital", "Hospital status", "Email verified", "Created"], accounts.map((account) => [account.name, account.email, account.role, account.status, account.isDemo ? "Yes" : "No", account.phone ?? "", account.hospital?.name ?? "", account.hospital?.status ?? "", account.emailVerifiedAt ? "Yes" : "No", account.createdAt]));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-saffron-700">Platform administration</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-primary-950">Accounts</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Search patient, hospital administrator, and super-admin accounts. Suspending an account revokes its existing sessions.</p></div>
        <Button variant="secondary" size="sm" onClick={exportPage} disabled={accounts.length === 0}><Download className="mr-2 h-4 w-4" aria-hidden />Export current page</Button>
      </div>
      {resource.error && <AdminError message={resource.error} retry={() => void resource.refresh()} />}
      <Card>
        <CardHeader><CardTitle>Account directory</CardTitle><CardDescription>{resource.data ? `${resource.data.total} accounts match these filters.` : "Account records are loaded from the protected database."}</CardDescription></CardHeader>
        <CardContent className="min-w-0 space-y-4">
          <form onSubmit={applyFilters} className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_190px_auto]">
            <label className="relative"><span className="sr-only">Search accounts</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden /><Input className="pl-9" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Name, email, or phone" /></label>
            <label className="sr-only" htmlFor="account-role">Role</label><select id="account-role" value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800"><option value="">All roles</option>{roles.filter(Boolean).map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>
            <label className="sr-only" htmlFor="account-status">Status</label><select id="account-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800"><option value="">All account statuses</option>{statuses.filter(Boolean).map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>
            <Button type="submit">Apply filters</Button>
          </form>
          {resource.loading && !resource.data ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading accounts…</p> : accounts.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 px-4 py-12 text-center"><UserRound className="mx-auto h-8 w-8 text-slate-400" aria-hidden /><p className="mt-3 font-medium text-primary-950">No matching accounts</p><p className="mt-1 text-sm text-slate-500">Change the filters or clear the search to see more accounts.</p></div> : <>
            <div className="min-w-0 max-w-full overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Account</th><th className="px-4 py-3 font-semibold">Role</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Hospital</th><th className="px-4 py-3 font-semibold">Joined</th><th className="px-4 py-3 font-semibold">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {accounts.map((account) => <tr key={account.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-4"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-primary-950">{account.name}</p>{account.isDemo && <DemoDataBadge />}</div><p className="mt-0.5 text-slate-600">{account.email}</p><p className="mt-1 text-xs text-slate-500">{account.phone || "No phone"} · {account.emailVerifiedAt ? "Email verified" : "Email not verified"}</p></td>
                    <td className="px-4 py-4"><span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">{account.role.replaceAll("_", " ")}</span></td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${account.status === "ACTIVE" ? "bg-green-50 text-green-800" : account.status === "SUSPENDED" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>{account.status.replaceAll("_", " ")}</span></td>
                    <td className="px-4 py-4">{account.hospital ? <><p className="font-medium text-slate-800">{account.hospital.name}</p><p className="text-xs text-slate-500">{account.hospital.status.replaceAll("_", " ")}</p></> : <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-slate-600">{formatAdminDate(account.createdAt)}</td>
                    <td className="px-4 py-4">{account.status === "ACTIVE" || account.status === "SUSPENDED" ? <Button variant={account.status === "ACTIVE" ? "secondary" : "primary"} size="sm" className={account.status === "ACTIVE" ? "text-red-700" : ""} disabled={account.id === currentUser?.id} onClick={() => setTarget(account)}>{account.status === "ACTIVE" ? <><UserRoundX className="mr-1.5 h-4 w-4" aria-hidden />Suspend</> : <><ShieldCheck className="mr-1.5 h-4 w-4" aria-hidden />Reactivate</>}</Button> : <span className="text-xs text-slate-500">Verification required</span>}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            {resource.data && <AdminPagination page={resource.data.page} pageSize={resource.data.pageSize} total={resource.data.total} onPage={(nextPage) => setPage(nextPage)} />}
          </>}
        </CardContent>
      </Card>
      <Dialog open={!!target} onOpenChange={(open) => { if (!open && !busy) setTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{target?.status === "SUSPENDED" ? "Reactivate account?" : "Suspend account?"}</DialogTitle><DialogDescription>{target ? `${target.name} (${target.email})` : ""}</DialogDescription></DialogHeader>
          <p className="text-sm text-slate-600">{target?.status === "SUSPENDED" ? "This account will be able to sign in again. Its previous sessions remain revoked." : "This takes effect immediately, revokes all existing sessions, and records the action in the audit trail."}</p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={() => setTarget(null)} disabled={busy}>Cancel</Button><Button variant={target?.status === "ACTIVE" ? "emergency" : "primary"} onClick={() => void setAccountStatus()} disabled={busy}>{busy ? "Saving…" : target?.status === "SUSPENDED" ? "Reactivate account" : "Suspend account"}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
