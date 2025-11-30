/*
  Warnings:

  - You are about to drop the column `client_id` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `pos_id` on the `pppoe_change_requests` table. All the data in the column will be lost.
  - You are about to drop the column `client_id` on the `usage_logs` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."payments" DROP CONSTRAINT "payments_client_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."pppoe_change_requests" DROP CONSTRAINT "pppoe_change_requests_pos_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."usage_logs" DROP CONSTRAINT "usage_logs_client_id_fkey";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "client_id";

-- AlterTable
ALTER TABLE "pppoe_change_requests" DROP COLUMN "pos_id";

-- AlterTable
ALTER TABLE "usage_logs" DROP COLUMN "client_id";
