-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('STATIC', 'DYNAMIC', 'PPPOE');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('PREPAID', 'POSTPAID');

-- CreateEnum
CREATE TYPE "DurationType" AS ENUM ('HALF_MONTHLY', 'MONTHLY', 'QUARTERLY', 'HALF_ANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'ONLINE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('WSP_ADMIN', 'POS_MANAGER', 'CLIENT');

-- CreateEnum
CREATE TYPE "IpStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'RESERVED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SuspensionReason" AS ENUM ('NON_PAYMENT', 'VIOLATION', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'SUSPEND', 'REACTIVATE', 'PAYMENT', 'UPGRADE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "pos_id" UUID,
    "client_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "contact_phone" TEXT,
    "allocated_bandwidth_mbps" DECIMAL(10,2) NOT NULL,
    "current_usage_mbps" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "pos_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "national_id" TEXT,
    "connection_type" "ConnectionType" NOT NULL,
    "pppoe_username" TEXT,
    "pppoe_password" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "account_balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "auto_renew_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "static_ip_pool" (
    "id" UUID NOT NULL,
    "pos_id" UUID NOT NULL,
    "ip_address" TEXT NOT NULL,
    "subnet_mask" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "dns_primary" TEXT,
    "dns_secondary" TEXT,
    "status" "IpStatus" NOT NULL DEFAULT 'AVAILABLE',
    "client_id" UUID,
    "assigned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "static_ip_pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_plans" (
    "id" UUID NOT NULL,
    "plan_name" TEXT NOT NULL,
    "service_type" "ServiceType" NOT NULL,
    "duration_type" "DurationType" NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL,
    "download_speed_mbps" DECIMAL(10,2) NOT NULL,
    "upload_speed_mbps" DECIMAL(10,2) NOT NULL,
    "data_capacity_gb" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_auto_renewed" BOOLEAN NOT NULL DEFAULT false,
    "bandwidth_allocated_mbps" DECIMAL(10,2) NOT NULL,
    "upgraded_to_subscription_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "subscription_id" UUID,
    "invoice_number" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "payment_reference" TEXT,
    "amount_paid" DECIMAL(10,2) NOT NULL,
    "extra_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_method" "PaymentMethod" NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bandwidth_pool" (
    "id" UUID NOT NULL,
    "total_wsp_bandwidth_mbps" DECIMAL(10,2) NOT NULL,
    "allocated_bandwidth_mbps" DECIMAL(10,2) NOT NULL,
    "available_bandwidth_mbps" DECIMAL(10,2) NOT NULL,
    "usage_percentage" DECIMAL(5,2) NOT NULL,
    "last_updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bandwidth_pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pppoe_change_requests" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "pos_id" UUID NOT NULL,
    "current_username" TEXT NOT NULL,
    "new_username" TEXT NOT NULL,
    "new_password" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "requested_by" TEXT,
    "approved_by" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "pppoe_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_logs" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "download_mb" DECIMAL(15,2) NOT NULL,
    "upload_mb" DECIMAL(15,2) NOT NULL,
    "total_usage_mb" DECIMAL(15,2) NOT NULL,
    "log_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suspension_history" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "suspension_reason" "SuspensionReason" NOT NULL,
    "reason_details" TEXT,
    "suspended_at" TIMESTAMP(3) NOT NULL,
    "reactivated_at" TIMESTAMP(3),
    "suspended_by" UUID,
    "reactivated_by" UUID,

    CONSTRAINT "suspension_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_role" "UserRole" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "action" "AuditAction" NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_client_id_key" ON "users"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_email_key" ON "clients"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_pppoe_username_key" ON "clients"("pppoe_username");

-- CreateIndex
CREATE UNIQUE INDEX "static_ip_pool_ip_address_key" ON "static_ip_pool"("ip_address");

-- CreateIndex
CREATE UNIQUE INDEX "static_ip_pool_client_id_key" ON "static_ip_pool"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_upgraded_to_subscription_id_key" ON "subscriptions"("upgraded_to_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "payments_invoice_id_key" ON "payments"("invoice_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_pos_id_fkey" FOREIGN KEY ("pos_id") REFERENCES "pos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_pos_id_fkey" FOREIGN KEY ("pos_id") REFERENCES "pos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "static_ip_pool" ADD CONSTRAINT "static_ip_pool_pos_id_fkey" FOREIGN KEY ("pos_id") REFERENCES "pos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "static_ip_pool" ADD CONSTRAINT "static_ip_pool_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "service_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_upgraded_to_subscription_id_fkey" FOREIGN KEY ("upgraded_to_subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pppoe_change_requests" ADD CONSTRAINT "pppoe_change_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pppoe_change_requests" ADD CONSTRAINT "pppoe_change_requests_pos_id_fkey" FOREIGN KEY ("pos_id") REFERENCES "pos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspension_history" ADD CONSTRAINT "suspension_history_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
