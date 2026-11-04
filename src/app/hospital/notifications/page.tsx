"use client";

import Link from "next/link";
import { BellRing, ArrowRight } from "lucide-react";
import { useHospitalPortal } from "@/components/hospital/hospital-store";
import { LiveRecordsNotice, HospitalStatusBadge, PageHeader, SectionCard } from "@/components/hospital/hospital-ui";
import { Button } from "@/components/ui/button";
import { formatHospitalTime } from "@/lib/hospital/hospital-data";
import { cn } from "@/lib/utils";

export default function HospitalNotificationsPage() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useHospitalPortal();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Management"
        title="Notifications"
        description="live notifications from the hospital portal activity stream."
        icon={BellRing}
        actions={
          <Button variant="secondary" size="sm" onClick={markAllNotificationsRead} disabled={unread === 0}>
            Mark all as read
          </Button>
        }
      />

      <LiveRecordsNotice>
        In-app notifications are stored with your hospital account and include appointment and record updates.
      </LiveRecordsNotice>

      <SectionCard
        title="Notification Center"
        description={`${unread} unread • ${notifications.length} total`}
      >
        <div className="space-y-2">
          {notifications.length === 0 && (
            <div className="flex items-center justify-center py-10 text-sm text-slate-500">
              No notifications.
            </div>
          )}
          {notifications.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              onClick={() => markNotificationRead(n.id)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-primary-50/40",
                n.read ? "border-slate-200" : "border-care-200 bg-care-50/40"
              )}
            >
              <HospitalStatusBadge status={n.tone === "critical" ? "CRITICAL" : n.tone === "warning" ? "URGENT" : n.tone === "success" ? "STABILIZED" : "RECEIVED"} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("text-sm", n.read ? "text-slate-700" : "font-medium text-primary-950")}>{n.title}</p>
                  <span className="text-xs text-slate-500">{formatHospitalTime(n.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{n.body}</p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 text-slate-400" aria-hidden />
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
