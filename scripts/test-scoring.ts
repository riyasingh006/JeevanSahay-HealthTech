import assert from "node:assert/strict";
import { rankHospitals, type HospitalLike } from "../src/lib/scoring";

const hospitals: HospitalLike[] = [
  {
    id: "near-routine",
    name: "Nearby General Hospital",
    lat: 0.009,
    lng: 0,
    type: "PUBLIC",
    beds: [
      { category: "GENERAL", total: 100, available: 40 },
      { category: "ICU", total: 10, available: 3 },
    ],
    services: [],
    doctors: [],
  },
  {
    id: "far-emergency",
    name: "Emergency Response Hospital",
    lat: 0.18,
    lng: 0,
    type: "PUBLIC",
    beds: [{ category: "EMERGENCY", total: 12, available: 5 }],
    services: [
      { key: "EMERGENCY", status: "AVAILABLE" },
      { key: "AMBULANCE", status: "AVAILABLE" },
    ],
    doctors: [],
  },
];

const location = { lat: 0, lng: 0 };
const routineRanking = rankHospitals(hospitals, { location });
const emergencyRanking = rankHospitals(hospitals, { location, requiresEmergency: true });

assert.equal(routineRanking[0]?.hospital.id, "near-routine");
assert.equal(emergencyRanking[0]?.hospital.id, "far-emergency");
console.log("PASS emergency urgency increases emergency-capability weighting while routine rankings preserve proximity and bed availability");
