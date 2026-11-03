-- CreateIndex
CREATE INDEX "Appointment_hospitalId_status_createdAt_idx" ON "Appointment"("hospitalId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatSession_userId_updatedAt_idx" ON "ChatSession"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Doctor_hospitalId_name_idx" ON "Doctor"("hospitalId", "name");

-- CreateIndex
CREATE INDEX "Doctor_hospitalId_specialty_availability_idx" ON "Doctor"("hospitalId", "specialty", "availability");

-- CreateIndex
CREATE INDEX "Hospital_status_createdAt_idx" ON "Hospital"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_hospitalId_status_createdAt_idx" ON "Review"("hospitalId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SavedHospital_hospitalId_idx" ON "SavedHospital"("hospitalId");

-- CreateIndex
CREATE INDEX "SearchRecord_userId_createdAt_idx" ON "SearchRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchRecord_mode_createdAt_idx" ON "SearchRecord"("mode", "createdAt");

-- CreateIndex
CREATE INDEX "User_hospitalId_role_status_idx" ON "User"("hospitalId", "role", "status");

-- CreateIndex
CREATE INDEX "User_role_status_createdAt_idx" ON "User"("role", "status", "createdAt");
