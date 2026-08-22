/*
  Warnings:

  - The `paymentGateway` column on the `payments` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "PaymentGateways" AS ENUM ('BKASH', 'NAGAD', 'SSLCOMMERZ', 'STRIPE');

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "paymentGateway",
ADD COLUMN     "paymentGateway" "PaymentGateways" NOT NULL DEFAULT 'BKASH';
