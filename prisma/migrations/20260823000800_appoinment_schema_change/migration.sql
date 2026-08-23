/*
  Warnings:

  - You are about to drop the column `date` on the `appoinments` table. All the data in the column will be lost.
  - You are about to drop the column `paymentId` on the `appoinments` table. All the data in the column will be lost.
  - You are about to drop the column `reason` on the `appoinments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "appoinments" DROP COLUMN "date",
DROP COLUMN "paymentId",
DROP COLUMN "reason";
