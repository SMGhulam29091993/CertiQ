-- Hand-written migration: things schema.prisma can't express (ADR-0006).
--   1. CHECK constraints
--   2. Certified views — the ONLY objects the semantic layer reads
--   3. certiq_reader — least-privilege, read-only role used by the API
-- Created with `prisma migrate dev --create-only` semantics: Prisma applies this file verbatim.

-- ── 1. Constraints ─────────────────────────────────────────────────────────
ALTER TABLE "patients" ADD CONSTRAINT "patients_age_band_check"
  CHECK ("age_band" IN ('18-29', '30-44', '45-59', '60+'));
ALTER TABLE "orders" ADD CONSTRAINT "orders_amount_usd_check" CHECK ("amount_usd" >= 0);

-- ── 2. Certified source views ──────────────────────────────────────────────
-- Each exposes patient_id so the small-group suppression guardrail can count
-- distinct patients per group. Enums are cast to text so dimension filters
-- (`col = ANY($n::text[])`) compare text with text.

CREATE VIEW v_patients AS
SELECT p.id AS patient_id, p.signup_date, p.state, p.age_band, p.acquisition_channel
FROM patients p;

CREATE VIEW v_orders AS
SELECT o.id AS order_id, o.patient_id, o.order_date, o.product_line, o.amount_usd,
       o.is_refill, o.status::text AS status, p.state, p.age_band, p.acquisition_channel
FROM orders o JOIN patients p ON p.id = o.patient_id;

CREATE VIEW v_consultations AS
SELECT c.id AS consultation_id, c.patient_id, c.consult_date, c.product_line,
       c.outcome::text AS outcome, p.state, p.age_band, p.acquisition_channel
FROM consultations c JOIN patients p ON p.id = c.patient_id;

CREATE VIEW v_support_tickets AS
SELECT t.id AS ticket_id, t.patient_id, t.created_at, t.category AS ticket_category,
       t.resolved_at, p.state
FROM support_tickets t JOIN patients p ON p.id = t.patient_id;

-- ── 3. Read-only role (demo password; set a real secret outside a demo) ────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'certiq_reader') THEN
    CREATE ROLE certiq_reader LOGIN PASSWORD 'certiq_reader';
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO certiq_reader', current_database());
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM certiq_reader;
GRANT USAGE ON SCHEMA public TO certiq_reader;
-- Views only: the reader cannot SELECT base tables or _prisma_migrations.
GRANT SELECT ON v_patients, v_orders, v_consultations, v_support_tickets TO certiq_reader;
ALTER ROLE certiq_reader SET default_transaction_read_only = on;
ALTER ROLE certiq_reader SET statement_timeout = '5s';
