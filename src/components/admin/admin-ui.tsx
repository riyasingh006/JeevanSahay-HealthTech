"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type AdminEnvelope<T> = { ok: boolean; error?: string; data?: T };

export async function adminRequest<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error("Network problem. The change was not confirmed; refresh before retrying.");
  }
  const result = (await response.json().catch(() => null)) as AdminEnvelope<T> | null;
  if (!response.ok || !result?.ok || result.data === undefined) {
    throw new Error(result?.error || "The request could not be completed.");
  }
  return result.data;
}

export function useAdminResource<T>(url: string) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const sequence = React.useRef(0);
  const refresh = React.useCallback(async () => {
    const requestId = ++sequence.current;
    setLoading(true);
    try {
      const next = await adminRequest<T>(url);
      if (requestId === sequence.current) {
        setData(next);
        setError("");
      }
    } catch (cause) {
      if (requestId === sequence.current) setError(cause instanceof Error ? cause.message : "The request could not be completed.");
    } finally {
      if (requestId === sequence.current) setLoading(false);
    }
  }, [url]);
  React.useEffect(() => {
    void refresh();
    return () => { sequence.current += 1; };
  }, [refresh]);
  return { data, loading, error, refresh, setData };
}

export function AdminError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden />{message}</span>
      <Button variant="secondary" size="sm" onClick={retry}>Retry</Button>
    </div>
  );
}

export function formatAdminDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(date);
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escape = (value: string | number | null | undefined) => {
    const raw = String(value ?? "");
    const safe = /^[\t\r\n ]*[=+@-]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const content = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AdminPagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
      <p className="text-sm text-slate-600">Showing {start}–{end} of {total}</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <span className="flex items-center px-2 text-sm text-slate-600">Page {page} of {pages}</span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </nav>
  );
}
