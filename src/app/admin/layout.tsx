import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminLayout } from "@/components/admin/admin-layout";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?reason=auth&next=%2Fadmin");
  if (session.role !== "SUPER_ADMIN") redirect("/dashboard?denied=admin");
  return <AdminLayout>{children}</AdminLayout>;
}
