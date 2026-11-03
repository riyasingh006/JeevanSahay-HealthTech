import { getSession } from "@/lib/auth";
import { ok, withApi } from "@/lib/api-helpers";

export const GET = withApi(async () => {
  const session = await getSession();
  if (!session) return ok({ user: null });
  return ok({
    user: {
      id: session.sub,
      name: session.name,
      email: session.email,
      role: session.role,
      hospitalId: session.hospitalId ?? null,
      isDemo: session.isDemo ?? false,
    },
  });
});
