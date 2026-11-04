import "server-only";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type SearchMode = "SEARCH" | "EMERGENCY" | "AI";

export async function recordPatientSearch(query: string, mode: SearchMode): Promise<void> {
  try {
    const session = await getSession();
    const normalizedQuery = query.trim().slice(0, 300);
    if (!session || session.role !== "PATIENT" || !normalizedQuery) return;
    await prisma.searchRecord.create({
      data: { userId: session.sub, query: normalizedQuery, mode },
    });
  } catch (error) {
    console.error("[patient-search] history could not be saved", error instanceof Error ? error.message : "unknown error");
  }
}
