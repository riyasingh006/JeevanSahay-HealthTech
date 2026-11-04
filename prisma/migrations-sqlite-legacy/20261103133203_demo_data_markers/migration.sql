ALTER TABLE "Hospital" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Hospital" SET "isDemo" = true WHERE "verifiedBy" = 'seed-fixture' OR ("registrationNumber" LIKE 'DL/HOSP/%' AND "email" LIKE 'care@%.example.in');
UPDATE "User" SET "isDemo" = true WHERE "email" IN ('patient@demo.in', 'hospital@demo.in');
