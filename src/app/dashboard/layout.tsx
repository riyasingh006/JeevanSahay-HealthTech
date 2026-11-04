import { redirect } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth";
import DashboardLayout from "@/components/patient/dashboard-layout";

export default async function PatientDashboardLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireRole("PATIENT");
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    if (error.status === 401) redirect("/login?reason=auth&next=%2Fdashboard");
    redirect("/dashboard?denied=patient");
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
