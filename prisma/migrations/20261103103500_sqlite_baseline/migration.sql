-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PATIENT',
    "phone" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "location" TEXT,
    "bloodGroup" TEXT,
    "allergies" TEXT,
    "conditions" TEXT,
    "medications" TEXT,
    "emergencyName" TEXT,
    "emergencyRel" TEXT,
    "emergencyPhone" TEXT,
    "sharePin" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" DATETIME,
    "googleSubject" TEXT,
    "authVersion" INTEGER NOT NULL DEFAULT 0,
    "hospitalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "authVersion" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthOtp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" DATETIME,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HospitalApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "hospitalName" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "hospitalType" TEXT NOT NULL DEFAULT 'PRIVATE',
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HospitalApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "type" TEXT NOT NULL DEFAULT 'PRIVATE',
    "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "registrationNumber" TEXT,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "emergencyPhone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "about" TEXT,
    "accreditation" TEXT,
    "established" INTEGER,
    "documentsSubmitted" TEXT NOT NULL DEFAULT '[]',
    "rejectionReason" TEXT,
    "verifiedAt" DATETIME,
    "verifiedBy" TEXT,
    "lastAvailabilityUpdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BedInventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "available" INTEGER NOT NULL,
    CONSTRAINT "BedInventory_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HospitalBed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ward" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "department" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HospitalBed_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "department" TEXT,
    "qualification" TEXT,
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "phone" TEXT,
    "email" TEXT,
    "availability" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "timings" TEXT,
    "languages" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Doctor_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HospitalDepartment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "head" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "location" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HospitalDepartment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT,
    "department" TEXT,
    "hours" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "details" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Service_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedHospital" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedHospital_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedHospital_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SearchRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'SEARCH',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmergencyCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "patientRef" TEXT NOT NULL,
    "age" INTEGER,
    "condition" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MODERATE',
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "department" TEXT,
    "location" TEXT,
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmergencyCase_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HospitalSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HospitalSettings_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "admissions" INTEGER NOT NULL DEFAULT 0,
    "discharges" INTEGER NOT NULL DEFAULT 0,
    "emergencyCases" INTEGER NOT NULL DEFAULT 0,
    "occupancyGeneral" REAL NOT NULL DEFAULT 0,
    "occupancyIcu" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "DailyStat_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "meta" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reporterName" TEXT,
    "contactEmail" TEXT,
    "relatedHospital" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "hospitalId" TEXT,
    "doctorId" TEXT,
    "patientName" TEXT NOT NULL,
    "patientEmail" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "hospitalNote" TEXT,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Appointment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");

-- CreateIndex
CREATE INDEX "UserSession_userId_revokedAt_idx" ON "UserSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthOtp_expiresAt_idx" ON "AuthOtp"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthOtp_userId_purpose_key" ON "AuthOtp"("userId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalApplication_userId_key" ON "HospitalApplication"("userId");

-- CreateIndex
CREATE INDEX "HospitalApplication_status_createdAt_idx" ON "HospitalApplication"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BedInventory_hospitalId_category_key" ON "BedInventory"("hospitalId", "category");

-- CreateIndex
CREATE INDEX "HospitalBed_hospitalId_status_category_idx" ON "HospitalBed"("hospitalId", "status", "category");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalBed_hospitalId_code_key" ON "HospitalBed"("hospitalId", "code");

-- CreateIndex
CREATE INDEX "HospitalDepartment_hospitalId_status_idx" ON "HospitalDepartment"("hospitalId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalDepartment_hospitalId_name_key" ON "HospitalDepartment"("hospitalId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Service_hospitalId_key_key" ON "Service"("hospitalId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SavedHospital_userId_hospitalId_key" ON "SavedHospital"("userId", "hospitalId");

-- CreateIndex
CREATE INDEX "EmergencyCase_hospitalId_status_reportedAt_idx" ON "EmergencyCase"("hospitalId", "status", "reportedAt");

-- CreateIndex
CREATE INDEX "EmergencyCase_hospitalId_severity_reportedAt_idx" ON "EmergencyCase"("hospitalId", "severity", "reportedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyCase_hospitalId_reference_key" ON "EmergencyCase"("hospitalId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalSettings_hospitalId_key" ON "HospitalSettings"("hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStat_hospitalId_date_key" ON "DailyStat"("hospitalId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_hospitalId_key" ON "Review"("userId", "hospitalId");

-- CreateIndex
CREATE INDEX "Appointment_patientId_createdAt_idx" ON "Appointment"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "Appointment_hospitalId_status_scheduledAt_idx" ON "Appointment"("hospitalId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_scheduledAt_idx" ON "Appointment"("doctorId", "scheduledAt");
