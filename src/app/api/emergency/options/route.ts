import { z } from "zod";
import { rankHospitals } from "@/lib/scoring";
import { loadVerifiedHospitals } from "@/lib/hospital-service";
import { interpretQuery } from "@/lib/nlp";
import { ok, parseBody, withApi } from "@/lib/api-helpers";
import { recordPatientSearch } from "@/lib/patient/search-history";

const schema = z.object({
  condition: z.string().trim().min(2).max(200),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const POST = withApi(
  async (req) => {
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;
    const { condition, lat, lng } = parsed.data;
    await recordPatientSearch(condition, "EMERGENCY");

    const need = interpretQuery(condition);
    const hospitals = await loadVerifiedHospitals();

    // Emergency mode only considers facilities with an active emergency dept.
    const capable = hospitals.filter(
      (h) =>
        h.services.some(
          (s) => s.key === "EMERGENCY" && s.status !== "UNAVAILABLE"
        ) &&
        (h.beds.find((b) => b.category === "EMERGENCY")?.available ?? 0) > 0
    );

    const ranked = rankHospitals(capable, {
      specialty: need.specialty,
      requiresIcu: need.requiresIcu,
      requiresEmergency: true,
      requiresDiagnostics: need.requiresDiagnostics,
      location:
        lat != null && lng != null ? { lat, lng } : undefined,
    });

    return ok({
      options: ranked.slice(0, 5),
      urgency: need.urgency,
    });
  },
  { limit: 20, windowMs: 60_000, keyPrefix: "emergency" }
);
