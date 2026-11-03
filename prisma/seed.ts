/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const MIN = 60 * 1000;

function ago(minutes: number) {
  return new Date(Date.now() - minutes * MIN);
}

interface BedSpec {
  category: string;
  total: number;
  available: number;
}

interface DoctorSpec {
  name: string;
  specialty: string;
  experienceYears: number;
  availability?: string;
  qualification?: string;
}

interface HospitalSpec {
  key: string;
  name: string;
  type: "GOVERNMENT" | "PRIVATE" | "TRUST" | "PSU";
  status: "VERIFIED" | "PENDING_VERIFICATION" | "REJECTED";
  area: string;
  city: string;
  pincode: string;
  lat: number;
  lng: number;
  phone: string;
  emergencyPhone: string;
  rejectionReason?: string;
  beds: BedSpec[];
  services: [string, string][]; // [key, status]
  doctors: DoctorSpec[];
}

const H = (s: string) => s;

const hospitals: HospitalSpec[] = [
  {
    key: "city",
    name: H("City Multispeciality Hospital"),
    type: "PRIVATE",
    status: "VERIFIED",
    area: "Connaught Place",
    city: "New Delhi",
    pincode: "110001",
    lat: 28.6304,
    lng: 77.2177,
    phone: "",
    emergencyPhone: "",
    beds: [
      { category: "GENERAL", total: 120, available: 37 },
      { category: "ICU", total: 20, available: 4 },
      { category: "EMERGENCY", total: 15, available: 8 },
      { category: "VENTILATOR", total: 10, available: 2 },
      { category: "PEDIATRIC", total: 25, available: 9 },
      { category: "MATERNITY", total: 20, available: 6 },
      { category: "ISOLATION", total: 10, available: 3 },
    ],
    services: [
      ["EMERGENCY", "AVAILABLE"],
      ["ICU", "AVAILABLE"],
      ["AMBULANCE", "AVAILABLE"],
      ["BLOOD_BANK", "AVAILABLE"],
      ["PHARMACY", "AVAILABLE"],
      ["DIAGNOSTICS", "AVAILABLE"],
      ["MRI", "AVAILABLE"],
      ["CT_SCAN", "AVAILABLE"],
      ["DIALYSIS", "LIMITED"],
      ["OPERATION_THEATRE", "AVAILABLE"],
    ],
    doctors: [
      { name: "Dr. Arjun Mehta", specialty: "CARDIOLOGY", experienceYears: 22, qualification: "MBBS, MD, DM (Cardiology)" },
      { name: "Dr. Kavita Bansal", specialty: "CARDIOLOGY", experienceYears: 14, qualification: "MBBS, DNB (Cardiology)", availability: "LIMITED" },
      { name: "Dr. Rohan Kapoor", specialty: "NEUROLOGY", experienceYears: 18, qualification: "MBBS, MD, DM (Neurology)" },
      { name: "Dr. Ishaan Verma", specialty: "EMERGENCY_MEDICINE", experienceYears: 9 },
      { name: "Dr. Nandini Rao", specialty: "GENERAL_MEDICINE", experienceYears: 12 },
      { name: "Dr. Sameer Khanna", specialty: "ORTHOPEDICS", experienceYears: 15 },
    ],
  },
  {
    key: "sanjeevani",
    name: H("Sanjeevani Super Speciality Hospital"),
    type: "PRIVATE",
    status: "VERIFIED",
    area: "Saket",
    city: "New Delhi",
    pincode: "110017",
    lat: 28.5245,
    lng: 77.2066,
    phone: "",
    emergencyPhone: "",
    beds: [
      { category: "GENERAL", total: 90, available: 12 },
      { category: "ICU", total: 24, available: 1 },
      { category: "EMERGENCY", total: 12, available: 3 },
      { category: "VENTILATOR", total: 14, available: 1 },
      { category: "PEDIATRIC", total: 14, available: 2 },
      { category: "MATERNITY", total: 12, available: 4 },
      { category: "ISOLATION", total: 8, available: 0 },
    ],
    services: [
      ["EMERGENCY", "AVAILABLE"],
      ["ICU", "LIMITED"],
      ["AMBULANCE", "AVAILABLE"],
      ["BLOOD_BANK", "LIMITED"],
      ["PHARMACY", "AVAILABLE"],
      ["DIAGNOSTICS", "AVAILABLE"],
      ["MRI", "AVAILABLE"],
      ["CT_SCAN", "AVAILABLE"],
      ["OPERATION_THEATRE", "AVAILABLE"],
    ],
    doctors: [
      { name: "Dr. Vikram Sethi", specialty: "NEUROLOGY", experienceYears: 25, qualification: "MBBS, DM (Neurology)" },
      { name: "Dr. Anjali Desai", specialty: "ONCOLOGY", experienceYears: 16 },
      { name: "Dr. Farhan Ali", specialty: "CARDIOLOGY", experienceYears: 19, availability: "LIMITED" },
      { name: "Dr. Meenakshi Iyer", specialty: "GYNECOLOGY", experienceYears: 13 },
    ],
  },
  {
    key: "aarogya",
    name: H("Aarogya Government Medical College"),
    type: "GOVERNMENT",
    status: "VERIFIED",
    area: "Karol Bagh",
    city: "New Delhi",
    pincode: "110005",
    lat: 28.6512,
    lng: 77.1907,
    phone: "",
    emergencyPhone: "",
    beds: [
      { category: "GENERAL", total: 240, available: 58 },
      { category: "ICU", total: 30, available: 7 },
      { category: "EMERGENCY", total: 25, available: 11 },
      { category: "VENTILATOR", total: 16, available: 4 },
      { category: "PEDIATRIC", total: 40, available: 15 },
      { category: "MATERNITY", total: 36, available: 12 },
      { category: "ISOLATION", total: 20, available: 6 },
    ],
    services: [
      ["EMERGENCY", "AVAILABLE"],
      ["ICU", "AVAILABLE"],
      ["AMBULANCE", "LIMITED"],
      ["BLOOD_BANK", "AVAILABLE"],
      ["PHARMACY", "AVAILABLE"],
      ["DIAGNOSTICS", "AVAILABLE"],
      ["CT_SCAN", "LIMITED"],
      ["DIALYSIS", "AVAILABLE"],
      ["OPERATION_THEATRE", "AVAILABLE"],
    ],
    doctors: [
      { name: "Dr. Sunita Sharma", specialty: "GENERAL_MEDICINE", experienceYears: 21 },
      { name: "Dr. Rakesh Yadav", specialty: "PULMONOLOGY", experienceYears: 17 },
      { name: "Dr. Pooja Nair", specialty: "PEDIATRICS", experienceYears: 11 },
      { name: "Dr. Mohit Aggarwal", specialty: "EMERGENCY_MEDICINE", experienceYears: 8, availability: "LIMITED" },
      { name: "Dr. Leena Joseph", specialty: "GASTROENTEROLOGY", experienceYears: 14 },
    ],
  },
  {
    key: "nirmal",
    name: H("Nirmal Hriday Trust Hospital"),
    type: "TRUST",
    status: "VERIFIED",
    area: "Chandni Chowk",
    city: "New Delhi",
    pincode: "110006",
    lat: 28.6506,
    lng: 77.2334,
    phone: "",
    emergencyPhone: "",
    beds: [
      { category: "GENERAL", total: 70, available: 22 },
      { category: "ICU", total: 8, available: 2 },
      { category: "EMERGENCY", total: 10, available: 4 },
      { category: "VENTILATOR", total: 4, available: 1 },
      { category: "PEDIATRIC", total: 12, available: 5 },
      { category: "MATERNITY", total: 10, available: 3 },
    ],
    services: [
      ["EMERGENCY", "LIMITED"],
      ["ICU", "LIMITED"],
      ["AMBULANCE", "AVAILABLE"],
      ["BLOOD_BANK", "UNAVAILABLE"],
      ["PHARMACY", "AVAILABLE"],
      ["DIAGNOSTICS", "LIMITED"],
      ["DIALYSIS", "AVAILABLE"],
    ],
    doctors: [
      { name: "Dr. Harish Chandra", specialty: "GENERAL_MEDICINE", experienceYears: 26 },
      { name: "Dr. Rehana Parveen", specialty: "DERMATOLOGY", experienceYears: 10 },
      { name: "Dr. Devansh Gupta", specialty: "ENT", experienceYears: 7, availability: "LIMITED" },
    ],
  },
  {
    key: "apex-cardiac",
    name: H("Apex Institute of Cardiac Sciences"),
    type: "PRIVATE",
    status: "VERIFIED",
    area: "Okhla Phase III",
    city: "New Delhi",
    pincode: "110020",
    lat: 28.5355,
    lng: 77.2713,
    phone: "",
    emergencyPhone: "",
    beds: [
      { category: "GENERAL", total: 80, available: 26 },
      { category: "ICU", total: 28, available: 6 },
      { category: "EMERGENCY", total: 14, available: 9 },
      { category: "VENTILATOR", total: 12, available: 3 },
      { category: "ISOLATION", total: 6, available: 2 },
    ],
    services: [
      ["EMERGENCY", "AVAILABLE"],
      ["ICU", "AVAILABLE"],
      ["AMBULANCE", "AVAILABLE"],
      ["BLOOD_BANK", "AVAILABLE"],
      ["PHARMACY", "AVAILABLE"],
      ["DIAGNOSTICS", "AVAILABLE"],
      ["CT_SCAN", "AVAILABLE"],
      ["OPERATION_THEATRE", "AVAILABLE"],
    ],
    doctors: [
      { name: "Dr. Nikhil Sinha", specialty: "CARDIOLOGY", experienceYears: 20 },
      { name: "Dr. Shreya Mukherjee", specialty: "CARDIOLOGY", experienceYears: 12 },
      { name: "Dr. Aakash Jain", specialty: "PULMONOLOGY", experienceYears: 13 },
      { name: "Dr. Tara Pillai", specialty: "EMERGENCY_MEDICINE", experienceYears: 10 },
    ],
  },
  {
    key: "vasundhara-neuro",
    name: H("Vasundhara Neuro & Spine Institute"),
    type: "PRIVATE",
    status: "VERIFIED",
    area: "Dwarka Sector 12",
    city: "New Delhi",
    pincode: "110075",
    lat: 28.5921,
    lng: 77.046,
    phone: "",
    emergencyPhone: "",
    beds: [
      { category: "GENERAL", total: 65, available: 18 },
      { category: "ICU", total: 16, available: 5 },
      { category: "EMERGENCY", total: 8, available: 4 },
      { category: "VENTILATOR", total: 8, available: 2 },
      { category: "ISOLATION", total: 4, available: 1 },
    ],
    services: [
      ["EMERGENCY", "AVAILABLE"],
      ["ICU", "AVAILABLE"],
      ["AMBULANCE", "LIMITED"],
      ["PHARMACY", "AVAILABLE"],
      ["DIAGNOSTICS", "AVAILABLE"],
      ["MRI", "AVAILABLE"],
      ["CT_SCAN", "AVAILABLE"],
      ["OPERATION_THEATRE", "AVAILABLE"],
    ],
    doctors: [
      { name: "Dr. Aditya Rathore", specialty: "NEUROLOGY", experienceYears: 17 },
      { name: "Dr. Meghna Dutta", specialty: "NEUROLOGY", experienceYears: 9, availability: "LIMITED" },
      { name: "Dr. Karan Malhotra", specialty: "ORTHOPEDICS", experienceYears: 14 },
    ],
  },
  {
    key: "lifeline-noida",
    name: H("Lifeline Multispeciality Hospital"),
    type: "PRIVATE",
    status: "VERIFIED",
    area: "Sector 62",
    city: "Noida",
    pincode: "201309",
    lat: 28.6273,
    lng: 77.3729,
    phone: "",
    emergencyPhone: "",
    beds: [
      { category: "GENERAL", total: 110, available: 41 },
      { category: "ICU", total: 18, available: 6 },
      { category: "EMERGENCY", total: 12, available: 7 },
      { category: "VENTILATOR", total: 9, available: 3 },
      { category: "PEDIATRIC", total: 22, available: 10 },
      { category: "MATERNITY", total: 18, available: 7 },
      { category: "ISOLATION", total: 8, available: 2 },
    ],
    services: [
      ["EMERGENCY", "AVAILABLE"],
      ["ICU", "AVAILABLE"],
      ["AMBULANCE", "AVAILABLE"],
      ["BLOOD_BANK", "AVAILABLE"],
      ["PHARMACY", "AVAILABLE"],
      ["DIAGNOSTICS", "AVAILABLE"],
      ["MRI", "LIMITED"],
      ["CT_SCAN", "AVAILABLE"],
      ["DIALYSIS", "AVAILABLE"],
      ["OPERATION_THEATRE", "AVAILABLE"],
    ],
    doctors: [
      { name: "Dr. Priyanka Chopra", specialty: "GYNECOLOGY", experienceYears: 15 },
      { name: "Dr. Varun Bhatia", specialty: "ORTHOPEDICS", experienceYears: 13 },
      { name: "Dr. Anil Grover", specialty: "CARDIOLOGY", experienceYears: 18 },
      { name: "Dr. Sneha Kulkarni", specialty: "PEDIATRICS", experienceYears: 10 },
      { name: "Dr. Imran Sheikh", specialty: "EMERGENCY_MEDICINE", experienceYears: 11 },
    ],
  },
  {
    key: "sahara-ghaziabad",
    name: H("Sahara Rural Referral Hospital"),
    type: "GOVERNMENT",
    status: "VERIFIED",
    area: "Loni Road",
    city: "Ghaziabad",
    pincode: "201102",
    lat: 28.6733,
    lng: 77.44,
    phone: "",
    emergencyPhone: "",
    beds: [
      { category: "GENERAL", total: 150, available: 64 },
      { category: "ICU", total: 10, available: 3 },
      { category: "EMERGENCY", total: 16, available: 9 },
      { category: "VENTILATOR", total: 6, available: 2 },
      { category: "PEDIATRIC", total: 30, available: 12 },
      { category: "MATERNITY", total: 24, available: 9 },
      { category: "ISOLATION", total: 18, available: 11 },
    ],
    services: [
      ["EMERGENCY", "AVAILABLE"],
      ["ICU", "LIMITED"],
      ["AMBULANCE", "LIMITED"],
      ["BLOOD_BANK", "LIMITED"],
      ["PHARMACY", "AVAILABLE"],
      ["DIAGNOSTICS", "LIMITED"],
      ["DIALYSIS", "LIMITED"],
    ],
    doctors: [
      { name: "Dr. Om Prakash Singh", specialty: "GENERAL_MEDICINE", experienceYears: 24 },
      { name: "Dr. Kusum Lata", specialty: "GYNECOLOGY", experienceYears: 16 },
      { name: "Dr. Jatin Pandey", specialty: "PULMONOLOGY", experienceYears: 9, availability: "LIMITED" },
    ],
  },
  {
    key: "ashoka-gurgaon",
    name: H("Ashoka Medicity"),
    type: "PRIVATE",
    status: "VERIFIED",
    area: "Sector 44",
    city: "Gurugram",
    pincode: "122003",
    lat: 28.4595,
    lng: 77.0266,
    phone: "",
    emergencyPhone: "",
    beds: [
      { category: "GENERAL", total: 130, available: 29 },
      { category: "ICU", total: 32, available: 3 },
      { category: "EMERGENCY", total: 18, available: 5 },
      { category: "VENTILATOR", total: 16, available: 2 },
      { category: "PEDIATRIC", total: 20, available: 6 },
      { category: "MATERNITY", total: 22, available: 8 },
      { category: "ISOLATION", total: 12, available: 4 },
    ],
    services: [
      ["EMERGENCY", "AVAILABLE"],
      ["ICU", "LIMITED"],
      ["AMBULANCE", "AVAILABLE"],
      ["BLOOD_BANK", "AVAILABLE"],
      ["PHARMACY", "AVAILABLE"],
      ["DIAGNOSTICS", "AVAILABLE"],
      ["MRI", "AVAILABLE"],
      ["CT_SCAN", "AVAILABLE"],
      ["DIALYSIS", "AVAILABLE"],
      ["OPERATION_THEATRE", "AVAILABLE"],
    ],
    doctors: [
      { name: "Dr. Rajat Nanda", specialty: "ONCOLOGY", experienceYears: 21 },
      { name: "Dr. Ishita Roy", specialty: "NEUROLOGY", experienceYears: 13 },
      { name: "Dr. Gaurav Thakur", specialty: "GASTROENTEROLOGY", experienceYears: 16 },
      { name: "Dr. Ritika Sood", specialty: "DERMATOLOGY", experienceYears: 8 },
    ],
  },
  {
    key: "punarnava-faridabad",
    name: H("Punarnava Ayurveda & Multispeciality Hospital"),
    type: "TRUST",
    status: "VERIFIED",
    area: "Sector 21D",
    city: "Faridabad",
    pincode: "121012",
    lat: 28.4089,
    lng: 77.3178,
    phone: "",
    emergencyPhone: "",
    beds: [
      { category: "GENERAL", total: 60, available: 24 },
      { category: "ICU", total: 6, available: 2 },
      { category: "EMERGENCY", total: 6, available: 3 },
      { category: "VENTILATOR", total: 3, available: 1 },
      { category: "MATERNITY", total: 14, available: 6 },
      { category: "PEDIATRIC", total: 10, available: 4 },
    ],
    services: [
      ["EMERGENCY", "LIMITED"],
      ["ICU", "LIMITED"],
      ["AMBULANCE", "AVAILABLE"],
      ["PHARMACY", "AVAILABLE"],
      ["DIAGNOSTICS", "LIMITED"],
      ["DIALYSIS", "UNAVAILABLE"],
    ],
    doctors: [
      { name: "Dr. Vandana Agnihotri", specialty: "GENERAL_MEDICINE", experienceYears: 18 },
      { name: "Dr. Siddharth Joshi", specialty: "ORTHOPEDICS", experienceYears: 12, availability: "LIMITED" },
    ],
  },
  {
    key: "metro-rajouri",
    name: H("Metro Heart & Lung Institute"),
    type: "PRIVATE",
    status: "VERIFIED",
    area: "Rajouri Garden",
    city: "New Delhi",
    pincode: "110027",
    lat: 28.6435,
    lng: 77.1207,
    phone: "",
    emergencyPhone: "",
    beds: [
      { category: "GENERAL", total: 75, available: 31 },
      { category: "ICU", total: 22, available: 8 },
      { category: "EMERGENCY", total: 10, available: 6 },
      { category: "VENTILATOR", total: 11, available: 4 },
      { category: "ISOLATION", total: 5, available: 2 },
    ],
    services: [
      ["EMERGENCY", "AVAILABLE"],
      ["ICU", "AVAILABLE"],
      ["AMBULANCE", "AVAILABLE"],
      ["BLOOD_BANK", "LIMITED"],
      ["PHARMACY", "AVAILABLE"],
      ["DIAGNOSTICS", "AVAILABLE"],
      ["CT_SCAN", "AVAILABLE"],
      ["DIALYSIS", "LIMITED"],
    ],
    doctors: [
      { name: "Dr. Sanjay Batra", specialty: "CARDIOLOGY", experienceYears: 23 },
      { name: "Dr. Neha Rastogi", specialty: "PULMONOLOGY", experienceYears: 15 },
      { name: "Dr. Abhinav Chugh", specialty: "EMERGENCY_MEDICINE", experienceYears: 7 },
    ],
  },
  {
    key: "shalimar-rohini",
    name: H("Shalimar Child & Maternity Hospital"),
    type: "PRIVATE",
    status: "VERIFIED",
    area: "Rohini Sector 9",
    city: "New Delhi",
    pincode: "110085",
    lat: 28.7325,
    lng: 77.11,
    phone: "",
    emergencyPhone: "",
    beds: [
      { category: "GENERAL", total: 55, available: 19 },
      { category: "ICU", total: 10, available: 4 },
      { category: "EMERGENCY", total: 6, available: 3 },
      { category: "VENTILATOR", total: 6, available: 2 },
      { category: "PEDIATRIC", total: 34, available: 16 },
      { category: "MATERNITY", total: 28, available: 11 },
    ],
    services: [
      ["EMERGENCY", "LIMITED"],
      ["ICU", "AVAILABLE"],
      ["AMBULANCE", "AVAILABLE"],
      ["PHARMACY", "AVAILABLE"],
      ["DIAGNOSTICS", "AVAILABLE"],
      ["OPERATION_THEATRE", "AVAILABLE"],
    ],
    doctors: [
      { name: "Dr. Ritu Malviya", specialty: "PEDIATRICS", experienceYears: 20 },
      { name: "Dr. Shalini Verma", specialty: "GYNECOLOGY", experienceYears: 17 },
      { name: "Dr. Nitin Arora", specialty: "PEDIATRICS", experienceYears: 9, availability: "LIMITED" },
    ],
  },
  {
    key: "bhagirathi-shahdara",
    name: H("Bhagirathi District Hospital"),
    type: "GOVERNMENT",
    status: "PENDING_VERIFICATION",
    area: "Shahdara",
    city: "New Delhi",
    pincode: "110032",
    lat: 28.6689,
    lng: 77.2869,
    phone: "",
    emergencyPhone: "",
    beds: [
      { category: "GENERAL", total: 100, available: 35 },
      { category: "ICU", total: 8, available: 2 },
      { category: "EMERGENCY", total: 10, available: 5 },
      { category: "VENTILATOR", total: 4, available: 1 },
      { category: "MATERNITY", total: 16, available: 6 },
    ],
    services: [
      ["EMERGENCY", "AVAILABLE"],
      ["ICU", "LIMITED"],
      ["AMBULANCE", "AVAILABLE"],
      ["PHARMACY", "AVAILABLE"],
      ["DIAGNOSTICS", "LIMITED"],
    ],
    doctors: [
      { name: "Dr. Mahesh Chand Tiwari", specialty: "GENERAL_MEDICINE", experienceYears: 19 },
      { name: "Dr. Sarita Rani", specialty: "GYNECOLOGY", experienceYears: 14 },
    ],
  },
  {
    key: "triveni-mehrauli",
    name: H("Triveni Trauma Centre"),
    type: "PRIVATE",
    status: "PENDING_VERIFICATION",
    area: "Mehrauli",
    city: "New Delhi",
    pincode: "110030",
    lat: 28.5184,
    lng: 77.185,
    phone: "",
    emergencyPhone: "",
    beds: [
      { category: "GENERAL", total: 40, available: 14 },
      { category: "ICU", total: 8, available: 3 },
      { category: "EMERGENCY", total: 8, available: 5 },
      { category: "VENTILATOR", total: 4, available: 2 },
    ],
    services: [
      ["EMERGENCY", "AVAILABLE"],
      ["ICU", "LIMITED"],
      ["AMBULANCE", "AVAILABLE"],
      ["OPERATION_THEATRE", "AVAILABLE"],
    ],
    doctors: [
      { name: "Dr. Yashpal Bisht", specialty: "ORTHOPEDICS", experienceYears: 18 },
      { name: "Dr. Kamna Saxena", specialty: "EMERGENCY_MEDICINE", experienceYears: 6 },
    ],
  },
  {
    key: "amrit-mayurvihar",
    name: H("Amrit Wellness Hospital"),
    type: "PRIVATE",
    status: "REJECTED",
    area: "Mayur Vihar Phase II",
    city: "New Delhi",
    pincode: "110091",
    lat: 28.605,
    lng: 77.29,
    phone: "",
    emergencyPhone: "",
    rejectionReason:
      "Mandatory registration certificate expired; renewed certificate not yet submitted for review.",
    beds: [
      { category: "GENERAL", total: 30, available: 12 },
      { category: "EMERGENCY", total: 4, available: 2 },
    ],
    services: [
      ["EMERGENCY", "LIMITED"],
      ["PHARMACY", "AVAILABLE"],
      ["DIAGNOSTICS", "LIMITED"],
    ],
    doctors: [
      { name: "Dr. Prerna Tandon", specialty: "DERMATOLOGY", experienceYears: 8 },
    ],
  },
  {
    key: "raksha-cancer",
    name: H("Raksha Cancer Care Institute"),
    type: "PRIVATE",
    status: "VERIFIED",
    area: "Vasant Kunj",
    city: "New Delhi",
    pincode: "110070",
    lat: 28.5212,
    lng: 77.158,
    phone: "",
    emergencyPhone: "",
    beds: [
      { category: "GENERAL", total: 85, available: 27 },
      { category: "ICU", total: 14, available: 4 },
      { category: "EMERGENCY", total: 8, available: 4 },
      { category: "VENTILATOR", total: 7, available: 2 },
      { category: "ISOLATION", total: 10, available: 5 },
    ],
    services: [
      ["EMERGENCY", "LIMITED"],
      ["ICU", "AVAILABLE"],
      ["AMBULANCE", "AVAILABLE"],
      ["BLOOD_BANK", "AVAILABLE"],
      ["PHARMACY", "AVAILABLE"],
      ["DIAGNOSTICS", "AVAILABLE"],
      ["CT_SCAN", "AVAILABLE"],
      ["MRI", "AVAILABLE"],
      ["OPERATION_THEATRE", "AVAILABLE"],
    ],
    doctors: [
      { name: "Dr. Manish Khandelwal", specialty: "ONCOLOGY", experienceYears: 24 },
      { name: "Dr. Swati Bhatt", specialty: "ONCOLOGY", experienceYears: 13 },
      { name: "Dr. Puneet Sabharwal", specialty: "GENERAL_MEDICINE", experienceYears: 15 },
    ],
  },
];

async function main() {
  const seedDemoData = process.env.SEED_DEMO_DATA === "true";
  if (seedDemoData) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Demo fixtures are disabled in production.");
    }
    const [users, hospitalsCount, reports, audits] = await Promise.all([
      db.user.count(),
      db.hospital.count(),
      db.report.count(),
      db.auditLog.count(),
    ]);
    if (users + hospitalsCount + reports + audits > 0) {
      throw new Error("Demo seeding requires an empty database. No records were changed.");
    }
    console.log("Seeding disposable demo data…");
    const passwordHash = await bcrypt.hash("Demo@1234", 12);

  const patient = await db.user.create({
    data: {
      name: "Aarav Sharma",
      email: "patient@demo.in",
      passwordHash,
      emailVerifiedAt: new Date(),
      role: "PATIENT",
      phone: "",
      isDemo: true,
      age: 34,
      gender: "Male",
      location: "Connaught Place, New Delhi",
      bloodGroup: "B+",
      allergies: "Penicillin",
      conditions: "Hypertension (controlled)",
      medications: "Telmisartan 40mg — once daily",
      emergencyName: "Sunita Sharma",
      emergencyRel: "Spouse",
      emergencyPhone: "",
      sharePin: "482913",
    },
  });

  // ---------- Hospitals ----------
  const created: Record<string, { id: string; name: string }> = {};

  for (const spec of hospitals) {
    const hospital = await db.hospital.create({
      data: {
        name: spec.name,
        type: spec.type,
        status: spec.status,
        registrationNumber: `DEMO-${spec.key.toUpperCase()}`,
        isDemo: true,
        addressLine: `${spec.area}`,
        city: spec.city,
        state: "Delhi NCR",
        pincode: spec.pincode,
        phone: spec.phone,
        emergencyPhone: spec.emergencyPhone,
        lat: spec.lat,
        lng: spec.lng,
        about: null,
        accreditation: null,
        established: null,
        documentsSubmitted: "[]",
        rejectionReason: spec.rejectionReason ?? null,
        verifiedAt: spec.status === "VERIFIED" ? ago(60 * 24 * 30) : null,
        verifiedBy: spec.status === "VERIFIED" ? "seed-fixture" : null,
        lastAvailabilityUpdate: new Date("2024-01-01T00:00:00.000Z"),
      },
    });
    created[spec.key] = { id: hospital.id, name: hospital.name };

    for (const b of spec.beds) {
      await db.bedInventory.create({
        data: {
          hospitalId: hospital.id,
          category: b.category,
          total: b.total,
          available: b.available,
        },
      });
    }

    for (const [key, status] of spec.services) {
      await db.service.create({
        data: { hospitalId: hospital.id, key, status },
      });
    }

    for (const doc of spec.doctors) {
      await db.doctor.create({
        data: {
          hospitalId: hospital.id,
          name: doc.name,
          specialty: doc.specialty,
          department: doc.specialty
            .split("_")
            .map((w) => w[0] + w.slice(1).toLowerCase())
            .join(" "),
          qualification: doc.qualification ?? "MBBS, MD",
          experienceYears: doc.experienceYears,
          availability: doc.availability ?? "AVAILABLE",
          timings: doc.availability === "LIMITED" ? "Mon–Fri · 2 PM–6 PM" : "Mon–Sat · 9 AM–1 PM",
          languages: "English, Hindi",
        },
      });
    }
  }

  // Hospital admin user → City Multispeciality Hospital
  await db.user.create({
    data: {
      name: "Dr. Meera Krishnan",
      email: "hospital@demo.in",
      passwordHash,
      emailVerifiedAt: new Date(),
      role: "HOSPITAL_ADMIN",
      phone: "",
      isDemo: true,
      hospitalId: created["city"].id,
    },
  });


  // ---------- Daily stats (last 14 days) ----------
  for (const spec of hospitals.filter((h) => h.status === "VERIFIED")) {
    const general = spec.beds.find((b) => b.category === "GENERAL")!;
    const icu = spec.beds.find((b) => b.category === "ICU");
    for (let day = 13; day >= 0; day--) {
      const date = new Date();
      date.setDate(date.getDate() - day);
      date.setHours(0, 0, 0, 0);
      const wave = Math.sin(day / 2.4 + spec.lat) * 8;
      const genOcc = Math.min(99, Math.max(
        40,
        Math.round(((general.total - general.available) / general.total) * 100 + wave),
      ));
      const icuOcc = icu
        ? Math.min(99, Math.max(35, Math.round(((icu.total - icu.available) / icu.total) * 100 + wave * 0.7)))
        : 55;
      await db.dailyStat.create({
        data: {
          hospitalId: created[spec.key].id,
          date,
          admissions: Math.max(2, Math.round(genOcc / 9 + wave / 3)),
          discharges: Math.max(1, Math.round(genOcc / 10 - wave / 4)),
          emergencyCases: Math.max(1, Math.round(8 + wave)),
          occupancyGeneral: genOcc,
          occupancyIcu: icuOcc,
        },
      });
    }
  }

  // ---------- Patient conveniences ----------
  await db.savedHospital.createMany({
    data: [
      { userId: patient.id, hospitalId: created["city"].id },
      { userId: patient.id, hospitalId: created["apex-cardiac"].id },
    ],
  });

  await db.searchRecord.createMany({
    data: [
      { userId: patient.id, query: "Cardiologist near Connaught Place", mode: "SEARCH" },
      { userId: patient.id, query: "Hospital with ICU availability", mode: "AI" },
      { userId: patient.id, query: "Chest pain emergency", mode: "EMERGENCY" },
    ].map((r, i) => ({ ...r, createdAt: new Date(Date.now() - (i + 1) * 3600e3 * 5) })),
  });

  await db.notification.createMany({
    data: [
      {
        userId: patient.id,
        title: "[DEMO] Hospital record updated",
        body: "Illustrative sample record only. It does not report current bed availability.",
        type: "INFO",
        link: `/hospitals/${created["city"].id}`,
      },
      {
        userId: patient.id,
        title: "[DEMO] Example inventory notice",
        body: "Illustrative sample record only. Contact a facility directly to confirm capacity.",
        type: "WARNING",
        link: `/hospitals/${created["apex-cardiac"].id}`,
      },
      {
        userId: patient.id,
        title: "[DEMO] Example specialist notice",
        body: "Sample specialist information is not a confirmed appointment or current schedule.",
        type: "SUCCESS",
        link: "/doctors?specialty=CARDIOLOGY",
      },
      {
        userId: patient.id,
        title: "Verify your health profile details",
        body: "Review your allergies and medications so hospitals can serve you faster in an emergency.",
        type: "INFO",
        link: "/profile",
      },
    ],
  });

  // ---------- Sample reports ----------
  await db.report.createMany({
    data: [
      {
        category: "DATA_ISSUE",
        subject: "[DEMO] Example bed-count report",
        message: "Demonstration-only report. No real patient or facility provided this information.",
        reporterName: null,
        contactEmail: null,
        relatedHospital: created["sahara-ghaziabad"].name,
        status: "IN_REVIEW",
      },
      {
        category: "FACILITY",
        subject: "[DEMO] Example service report",
        message: "Demonstration-only report. No real patient or facility provided this information.",
        contactEmail: null,
        relatedHospital: created["nirmal"].name,
        status: "OPEN",
      },
    ],
  });

  console.log(`Seeded ${hospitals.length} hospitals and demo data. Demo accounts use the documented development-only password.`);
  }

  const adminEmail = process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (Boolean(adminEmail) !== Boolean(adminPassword)) {
    throw new Error("Set both SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD, or neither.");
  }
  if (adminEmail && adminPassword) {
    if (!adminEmail.includes("@") || adminPassword.length < 16 || Buffer.byteLength(adminPassword, "utf8") > 72) {
      throw new Error("Use a valid admin email and a unique password between 16 and 72 bytes.");
    }
    const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } });
    if (existingAdmin) {
      if (existingAdmin.role !== "SUPER_ADMIN") {
        throw new Error("Refusing to promote an existing non-admin account.");
      }
      console.log("The configured super-admin account already exists; it was left unchanged.");
    } else {
      await db.user.create({
        data: {
          name: process.env.SEED_SUPER_ADMIN_NAME?.trim() || "Platform Administrator",
          email: adminEmail,
          passwordHash: await bcrypt.hash(adminPassword, 12),
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      });
      console.log("Provisioned the configured super-admin account.");
    }
  }
  if (!seedDemoData && !adminEmail) console.log("No seed changes requested.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
