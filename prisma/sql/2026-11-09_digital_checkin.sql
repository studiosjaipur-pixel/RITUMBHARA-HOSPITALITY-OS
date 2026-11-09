-- Digital check-in + visitor log. Run in the Supabase SQL editor, or `npx prisma db push`.
CREATE TABLE IF NOT EXISTS "CheckIn" (
  "id" TEXT PRIMARY KEY,
  "reservationId" TEXT NOT NULL UNIQUE REFERENCES "Reservation"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "fullName" TEXT, "dateOfBirth" TEXT, "gender" TEXT, "nationality" TEXT,
  "isForeign" BOOLEAN NOT NULL DEFAULT false,
  "idType" TEXT, "idNumber" TEXT, "address" TEXT, "purpose" TEXT,
  "companions" INTEGER NOT NULL DEFAULT 0,
  "formC" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CheckIn_status_idx" ON "CheckIn"("status");
CREATE TABLE IF NOT EXISTS "VisitorLog" (
  "id" TEXT PRIMARY KEY,
  "reservationId" TEXT NOT NULL REFERENCES "Reservation"("id") ON DELETE CASCADE,
  "visitorName" TEXT NOT NULL, "visitorPhone" TEXT, "idNote" TEXT, "purpose" TEXT,
  "inAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "outAt" TIMESTAMP(3), "loggedBy" TEXT
);
CREATE INDEX IF NOT EXISTS "VisitorLog_reservationId_idx" ON "VisitorLog"("reservationId");
CREATE INDEX IF NOT EXISTS "VisitorLog_inAt_idx" ON "VisitorLog"("inAt");
