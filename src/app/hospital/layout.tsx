import { redirect } from "next/navigation";
import { AuthError, requireRole } from "@/lib/auth";
import HospitalLayout from "@/components/hospital/hospital-layout";

export default async function HospitalPortalLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireRole("HOSPITAL_ADMIN");
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    if (error.status === 401) redirect("/login?reason=auth&next=%2Fhospital");
    redirect("/dashboard?denied=portal");
  }

  return <HospitalLayout>{children}</HospitalLayout>;
}
