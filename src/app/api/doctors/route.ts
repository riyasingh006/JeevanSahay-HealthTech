import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, withApi } from "@/lib/api-helpers";

const schema = z.object({
  q: z.string().trim().max(80).optional(),
  specialty: z.string().trim().max(40).optional(),
  city: z.string().trim().max(60).optional(),
});

/** Collapse runs of whitespace so "  Harish   Chandra " matches "Harish Chandra". */
function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Split a typed name into search tokens. A bare "Dr"/"Dr." is dropped because
 * it is a title, not part of the name, and matching it as a substring would
 * wrongly hit unrelated names (e.g. "Sandra").
 */
function nameTokens(query: string): string[] {
  return collapse(query)
    .split(" ")
    .filter((token) => token.length > 0 && !/^dr\.?$/i.test(token));
}

/** Lowercase, strip a leading "Dr." title and all punctuation/whitespace. */
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/^dr\.?\s+/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Higher score = closer to what the user typed. */
function nameRelevance(name: string, queryNorm: string): number {
  if (!queryNorm) return 0;
  const normalized = normalizeName(name);
  if (normalized === queryNorm) return 3;
  if (normalized.startsWith(queryNorm)) return 2;
  if (normalized.includes(queryNorm)) return 1;
  return 0;
}

function availabilityRank(availability: string): number {
  if (availability === "AVAILABLE") return 0;
  if (availability === "LIMITED") return 1;
  return 2;
}

export const GET = withApi(
  async (req) => {
    const url = new URL(req.url);
    const params = schema.parse(Object.fromEntries(url.searchParams));

    const q = params.q ? collapse(params.q) : "";
    const session = await getSession();
    const city = params.city ? collapse(params.city) : "";
    const specialty = params.specialty?.trim() ?? "";
    const tokens = nameTokens(q);

    const doctors = await prisma.doctor.findMany({
      where: {
        ...(specialty ? { specialty } : {}),
        // Each token must appear in the name, so extra spaces between words
        // (or a missing "Dr.") never break the match.
        ...(tokens.length
          ? { AND: tokens.map((token) => ({ name: { contains: token, mode: "insensitive" as const } })) }
          : {}),
        hospital: {
          status: "VERIFIED",
          ...(session?.isDemo ? {} : { isDemo: false }),
          ...(city ? { city: { contains: city, mode: "insensitive" as const } } : {}),
        },
      },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            city: true,
            type: true,
            lastAvailabilityUpdate: true,
            isDemo: true,
          },
        },
      },
      take: 120,
    });

    const queryNorm = normalizeName(q);
    const ranked = doctors
      .sort((a, b) => {
        // 1. Exact / closest name match first when the user searched by name.
        const relevance = nameRelevance(b.name, queryNorm) - nameRelevance(a.name, queryNorm);
        if (relevance !== 0) return relevance;
        // 2. Verified availability, then experience as the reliable signal.
        const availability =
          availabilityRank(a.availability) - availabilityRank(b.availability);
        if (availability !== 0) return availability;
        if (b.experienceYears !== a.experienceYears) {
          return b.experienceYears - a.experienceYears;
        }
        return a.name.localeCompare(b.name);
      })
      .slice(0, 60);

    return ok({ doctors: ranked });
  },
  { limit: 90, windowMs: 60_000, keyPrefix: "doctors" }
);
