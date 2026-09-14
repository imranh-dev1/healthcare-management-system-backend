-- DropIndex
DROP INDEX "appoinments_patientId_doctorId_scheduleId_key";

-- CreateIndex
CREATE UNIQUE INDEX "unique_appointment" ON "appoinments"("patientId", "doctorId", "scheduleId") WHERE (status <> 'CANCELLED');