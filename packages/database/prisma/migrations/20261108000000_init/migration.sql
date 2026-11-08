-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('completed', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "consult_outcome" AS ENUM ('approved', 'denied');

-- CreateTable
CREATE TABLE "patients" (
    "id" SERIAL NOT NULL,
    "signup_date" DATE NOT NULL,
    "state" CHAR(2) NOT NULL,
    "age_band" TEXT NOT NULL,
    "acquisition_channel" TEXT NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "consult_date" DATE NOT NULL,
    "product_line" TEXT NOT NULL,
    "outcome" "consult_outcome" NOT NULL,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "order_date" DATE NOT NULL,
    "product_line" TEXT NOT NULL,
    "amount_usd" DECIMAL(10,2) NOT NULL,
    "is_refill" BOOLEAN NOT NULL,
    "status" "order_status" NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "category" TEXT NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patients_signup_date_idx" ON "patients"("signup_date");

-- CreateIndex
CREATE INDEX "consultations_consult_date_idx" ON "consultations"("consult_date");

-- CreateIndex
CREATE INDEX "orders_order_date_idx" ON "orders"("order_date");

-- CreateIndex
CREATE INDEX "support_tickets_created_at_idx" ON "support_tickets"("created_at");

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
