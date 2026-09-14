/*
  Warnings:

  - A unique constraint covering the columns `[patientId,doctorId,scheduleId]` on the table `appoinments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[scheduleId,serialNumber,joiningTime]` on the table `appoinments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `doctorId` to the `appoinments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `patientId` to the `appoinments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scheduleId` to the `appoinments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "appoinments" ADD COLUMN     "doctorId" TEXT NOT NULL,
ADD COLUMN     "joiningTime" TIMESTAMP(3),
ADD COLUMN     "patientId" TEXT NOT NULL,
ADD COLUMN     "prescriptionPublicId" TEXT,
ADD COLUMN     "prescriptionUrl" TEXT,
ADD COLUMN     "recordPublicId" TEXT,
ADD COLUMN     "recordUrl" TEXT,
ADD COLUMN     "scheduleId" TEXT NOT NULL,
ADD COLUMN     "serialNumber" INTEGER;

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "totalSlots" INTEGER NOT NULL,
    "availableSlots" INTEGER NOT NULL,
    "meetingLink" TEXT NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "doctorId" TEXT NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedules_doctorId_startDateTime_endDateTime_key" ON "schedules"("doctorId", "startDateTime", "endDateTime");

-- CreateIndex
CREATE UNIQUE INDEX "appoinments_patientId_doctorId_scheduleId_key" ON "appoinments"("patientId", "doctorId", "scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "appoinments_scheduleId_serialNumber_joiningTime_key" ON "appoinments"("scheduleId", "serialNumber", "joiningTime");

-- AddForeignKey
ALTER TABLE "appoinments" ADD CONSTRAINT "appoinments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appoinments" ADD CONSTRAINT "appoinments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appoinments" ADD CONSTRAINT "appoinments_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
