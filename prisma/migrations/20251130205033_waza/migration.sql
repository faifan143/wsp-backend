/*
  Warnings:

  - Changed the type of `entity_type` on the `audit_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('USER', 'POS', 'CLIENT', 'STATIC_IP_POOL', 'SERVICE_PLAN', 'SUBSCRIPTION', 'INVOICE', 'PAYMENT', 'BANDWIDTH_POOL', 'PPPOE_CHANGE_REQUEST', 'USAGE_LOG', 'SUSPENSION_HISTORY', 'AUDIT_LOG');

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "entity_type",
ADD COLUMN     "entity_type" "EntityType" NOT NULL;
