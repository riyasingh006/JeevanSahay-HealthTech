/**
 * जीवन Sahay — Modular hospital recommendation engine.
 *
 * Initial implementation uses transparent, rule-based scoring so results are
 * explainable to users ("Why this hospital?"). Each component returns a value
 * in [0,1]; the weighted sum maps to a 0–100 suitability score.
 *
 * The weights and component functions are isolated behind the
 * `ScoreComponents` interface so an ML ranking model can replace any
 * component later without touching callers.
 */

import { RECOMMENDATION_WEIGHTS } from "./constants";
import { clamp, estimateEtaMinutes, haversineKm } from "./utils";

export type AvailabilityStatus = "AVAILABLE" | "LIMITED" | "UNAVAILABLE";

export interface HospitalLike {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  status?: string;
  isDemo?: boolean;
  beds: { category: string; total: number; available: number }[];
  services: { key: string; status: string }[];
  doctors: {
    specialty: string;
    availability: string;
  }[];
}

export interface CareNeed {
  specialty?: string; // SpecialtyKey
  requiresIcu?: boolean;
  requiresEmergency?: boolean;
  requiresVentilator?: boolean;
  requiresDiagnostics?: boolean;
  location?: { lat: number; lng: number };
}

export interface ScoreComponentResult {
  medicalCompatibility: number;
  specialistAvailability: number;
  bedIcuAvailability: number;
  emergencyCapability: number;
  distanceEta: number;
  otherServices: number;
}

export interface ScoredHospital<T extends HospitalLike> {
  hospital: T;
  score: number; // 0–100
  distanceKm: number;
  etaMinutes: number;
  breakdown: ScoreComponentResult;
  reasons: string[];
}

const W = RECOMMENDATION_WEIGHTS;

/** Medical compatibility — does the facility match the stated requirement? */
function scoreMedicalCompatibility(
  hospital: HospitalLike,
  need: CareNeed
): { value: number; matchedSpecialty: boolean } {
  let value = 0.55; // neutral baseline for general care queries

  if (need.specialty) {
    const matching = hospital.doctors.filter(
      (d) => d.specialty === need.specialty
    );
    if (matching.length === 0) {
      const deptService = hospital.services.find(
        (s) => s.key === need.specialty && s.status !== "UNAVAILABLE"
      );
      value = deptService ? 0.5 : 0.05;
    } else {
      value = clamp(0.6 + Math.min(matching.length, 5) * 0.08, 0, 1);
    }
  }

  if (need.requiresDiagnostics) {
    const diag = hospital.services.find((s) => s.key === "DIAGNOSTICS");
    if (!diag || diag.status === "UNAVAILABLE") value *= 0.45;
  }
  if (need.requiresVentilator) {
    const vent = hospital.beds.find((b) => b.category === "VENTILATOR");
    if (!vent || vent.available <= 0) value *= 0.35;
  }

  return { value: clamp(value, 0, 1), matchedSpecialty: !!need.specialty };
}

function availabilityToNumber(status: string | undefined): number {
  switch ((status ?? "").toUpperCase()) {
    case "AVAILABLE":
      return 1;
    case "LIMITED":
      return 0.5;
    default:
      return 0;
  }
}

function scoreSpecialistAvailability(hospital: HospitalLike, need: CareNeed): number {
  const relevant = need.specialty
    ? hospital.doctors.filter((d) => d.specialty === need.specialty)
    : hospital.doctors;
  if (relevant.length === 0) return need.specialty ? 0 : 0.5;
  const avg =
    relevant.reduce(
      (sum, d) => sum + availabilityToNumber(d.availability),
      0
    ) / relevant.length;
  return clamp(avg, 0, 1);
}

function scoreBedIcuAvailability(hospital: HospitalLike, need: CareNeed): number {
  const general = hospital.beds.find((b) => b.category === "GENERAL");
  const icu = hospital.beds.find((b) => b.category === "ICU");

  const generalScore = general
    ? clamp(general.available / Math.max(8, general.total * 0.25), 0, 1)
    : 0;
  const icuScore = icu
    ? clamp(icu.available / Math.max(2, icu.total * 0.2), 0, 1)
    : 0;

  if (need.requiresIcu) return clamp(generalScore * 0.3 + icuScore * 0.7, 0, 1);
  return clamp(generalScore * 0.65 + icuScore * 0.35, 0, 1);
}

function scoreEmergencyCapability(hospital: HospitalLike): number {
  const emergencySvc = hospital.services.find((s) => s.key === "EMERGENCY");
  const ambulance = hospital.services.find((s) => s.key === "AMBULANCE");
  const emergencyBeds = hospital.beds.find((b) => b.category === "EMERGENCY");

  let value = 0;
  value += availabilityToNumber(emergencySvc?.status) * 0.45;
  value += availabilityToNumber(ambulance?.status) * 0.2;
  if (emergencyBeds) {
    value += clamp(emergencyBeds.available / Math.max(4, emergencyBeds.total * 0.3), 0, 1) * 0.35;
  }

  // Emergency capability is always relevant, but weighted highest when the
  // user's need is explicitly urgent.
  return clamp(value, 0, 1);
}

function scoreDistanceEta(distanceKm: number): number {
  // 1.0 at <=1 km, decays smoothly; ~0.5 at 7 km, ~0.15 at 20 km.
  return clamp(Math.exp(-distanceKm / 9), 0, 1);
}

function scoreOtherServices(hospital: HospitalLike): number {
  const total = hospital.services.length;
  if (total === 0) return 0;
  const breadth = hospital.services.reduce(
    (sum, s) => sum + availabilityToNumber(s.status),
    0
  );
  return clamp(breadth / total, 0, 1);
}

/**
 * Rank hospitals against a care need. Pure function — no I/O — so it can run
 * on the server or be swapped for a trained model returning the same shape.
 */
export function rankHospitals<T extends HospitalLike>(
  hospitals: T[],
  need: CareNeed
): ScoredHospital<T>[] {
  const origin = need.location ?? null;
  const emergencyWeight = need.requiresEmergency ? W.emergencyCapability * 2.5 : W.emergencyCapability;
  const totalWeight = Object.values(W).reduce((sum, weight) => sum + weight, 0) - W.emergencyCapability + emergencyWeight;

  const scored = hospitals.map<ScoredHospital<T>>((hospital) => {
    const distanceKm = origin
      ? haversineKm(origin, { lat: hospital.lat, lng: hospital.lng })
      : 0;
    const etaMinutes = estimateEtaMinutes(distanceKm);

    const medical = scoreMedicalCompatibility(hospital, need);
    const specialists = scoreSpecialistAvailability(hospital, need);
    const beds = scoreBedIcuAvailability(hospital, need);
    const emergency = scoreEmergencyCapability(hospital);
    const distance = origin ? scoreDistanceEta(distanceKm) : 0.6;
    const other = scoreOtherServices(hospital);

    const breakdown: ScoreComponentResult = {
      medicalCompatibility: round(medical.value),
      specialistAvailability: round(specialists),
      bedIcuAvailability: round(beds),
      emergencyCapability: round(emergency),
      distanceEta: round(distance),
      otherServices: round(other),
    };

    const raw =
      breakdown.medicalCompatibility * W.medicalCompatibility +
      breakdown.specialistAvailability * W.specialistAvailability +
      breakdown.bedIcuAvailability * W.bedIcuAvailability +
      breakdown.emergencyCapability * emergencyWeight +
      breakdown.distanceEta * W.distanceEta +
      breakdown.otherServices * W.otherServices;

    const score = Math.round(clamp(raw / totalWeight, 0, 1) * 100);

    const reasons = buildReasons(hospital, need, breakdown, {
      distanceKm,
      etaMinutes,
      matchedSpecialty: medical.matchedSpecialty,
    });

    return { hospital, score, distanceKm, etaMinutes, breakdown, reasons };
  });

  return scored.sort((a, b) => b.score - a.score);
}

function buildReasons(
  hospital: HospitalLike,
  need: CareNeed,
  b: ScoreComponentResult,
  ctx: { distanceKm: number; etaMinutes: number; matchedSpecialty: boolean }
): string[] {
  const reasons: string[] = [];
  const has = (key: string, statuses = ["AVAILABLE"]) =>
    hospital.services.some((s) => s.key === key && statuses.includes(s.status));

  if (ctx.matchedSpecialty)
    reasons.push("Required specialty listed");
  if (need.requiresIcu || b.bedIcuAvailability >= 0.6) {
    const icu = hospital.beds.find((x) => x.category === "ICU");
    if (icu && icu.available > 0)
      reasons.push(`Facility-reported ICU beds: ${icu.available}`);
  }
  if (has("EMERGENCY")) reasons.push("Emergency services listed");
  if (need.requiresDiagnostics && has("DIAGNOSTICS"))
    reasons.push("Required diagnostics listed");
  if (has("AMBULANCE") && (need.requiresEmergency || ctx.distanceKm > 12))
    reasons.push("Ambulance service listed");
  if (ctx.distanceKm <= 6) reasons.push("Nearby by estimated distance");
  else if (b.distanceEta >= 0.4) reasons.push("Reasonable estimated distance");

  return reasons.slice(0, 5);
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}
