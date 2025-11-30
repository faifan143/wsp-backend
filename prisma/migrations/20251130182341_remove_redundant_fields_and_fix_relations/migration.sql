/*
  Warnings:

  - You are about to drop the column `payment_status` on the `invoices` table. All the data in the column will be lost.
  - The `received_by` column on the `payments` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `requested_by` column on the `pppoe_change_requests` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `approved_by` column on the `pppoe_change_requests` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `total_usage_mb` on the `usage_logs` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."payments_invoice_id_key";

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "payment_status";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "received_by",
ADD COLUMN     "received_by" UUID;

-- AlterTable
ALTER TABLE "pppoe_change_requests" DROP COLUMN "requested_by",
ADD COLUMN     "requested_by" UUID,
DROP COLUMN "approved_by",
ADD COLUMN     "approved_by" UUID;

-- AlterTable
ALTER TABLE "usage_logs" DROP COLUMN "total_usage_mb";

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pppoe_change_requests" ADD CONSTRAINT "pppoe_change_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pppoe_change_requests" ADD CONSTRAINT "pppoe_change_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspension_history" ADD CONSTRAINT "suspension_history_suspended_by_fkey" FOREIGN KEY ("suspended_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspension_history" ADD CONSTRAINT "suspension_history_reactivated_by_fkey" FOREIGN KEY ("reactivated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
