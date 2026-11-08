-- CertiQ demo schema. SYNTHETIC DATA ONLY — no names, contact details or clinical notes exist here.
-- Re-runnable: drops and recreates everything (demo database, not a migration chain — see ADR-0003).

DROP VIEW IF EXISTS v_support_tickets, v_consultations, v_orders, v_patients;
DROP TABLE IF EXISTS support_tickets, orders, consultations, patients;

CREATE TABLE patients (
  id                  SERIAL PRIMARY KEY,
  signup_date         DATE NOT NULL,
  state               CHAR(2) NOT NULL,
  age_band            TEXT NOT NULL CHECK (age_band IN ('18-29', '30-44', '45-59', '60+')),
  acquisition_channel TEXT NOT NULL
);

CREATE TABLE consultations (
  id            SERIAL PRIMARY KEY,
  patient_id    INT NOT NULL REFERENCES patients(id),
  consult_date  DATE NOT NULL,
  product_line  TEXT NOT NULL,
  outcome       TEXT NOT NULL CHECK (outcome IN ('approved', 'denied'))
);

CREATE TABLE orders (
  id            SERIAL PRIMARY KEY,
  patient_id    INT NOT NULL REFERENCES patients(id),
  order_date    DATE NOT NULL,
  product_line  TEXT NOT NULL,
  amount_usd    NUMERIC(10, 2) NOT NULL CHECK (amount_usd >= 0),
  is_refill     BOOLEAN NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('completed', 'refunded', 'cancelled'))
);

CREATE TABLE support_tickets (
  id           SERIAL PRIMARY KEY,
  patient_id   INT NOT NULL REFERENCES patients(id),
  created_at   TIMESTAMPTZ NOT NULL,
  category     TEXT NOT NULL,
  resolved_at  TIMESTAMPTZ
);

CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_consultations_date ON consultations(consult_date);
CREATE INDEX idx_tickets_created ON support_tickets(created_at);
CREATE INDEX idx_patients_signup ON patients(signup_date);

-- ── Certified source views ──────────────────────────────────────────────
-- The semantic layer reads ONLY these views. Each exposes patient_id so the
-- small-group suppression guardrail can count distinct patients per group.

CREATE VIEW v_patients AS
SELECT p.id AS patient_id, p.signup_date, p.state, p.age_band, p.acquisition_channel
FROM patients p;

CREATE VIEW v_orders AS
SELECT o.id AS order_id, o.patient_id, o.order_date, o.product_line, o.amount_usd,
       o.is_refill, o.status, p.state, p.age_band, p.acquisition_channel
FROM orders o JOIN patients p ON p.id = o.patient_id;

CREATE VIEW v_consultations AS
SELECT c.id AS consultation_id, c.patient_id, c.consult_date, c.product_line, c.outcome,
       p.state, p.age_band, p.acquisition_channel
FROM consultations c JOIN patients p ON p.id = c.patient_id;

CREATE VIEW v_support_tickets AS
SELECT t.id AS ticket_id, t.patient_id, t.created_at, t.category AS ticket_category,
       t.resolved_at, p.state
FROM support_tickets t JOIN patients p ON p.id = t.patient_id;

-- ── Read-only role used by the API (guardrail: least privilege) ──────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'certiq_reader') THEN
    CREATE ROLE certiq_reader LOGIN PASSWORD 'certiq_reader';
  END IF;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM certiq_reader;
GRANT CONNECT ON DATABASE certiq TO certiq_reader;
GRANT USAGE ON SCHEMA public TO certiq_reader;
-- Views only. The reader cannot SELECT base tables directly.
GRANT SELECT ON v_patients, v_orders, v_consultations, v_support_tickets TO certiq_reader;
ALTER ROLE certiq_reader SET default_transaction_read_only = on;
ALTER ROLE certiq_reader SET statement_timeout = '5s';
