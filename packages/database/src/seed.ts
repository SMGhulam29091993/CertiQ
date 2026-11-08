import pg from 'pg';

/**
 * Deterministic synthetic telehealth data. Same seed → same rows → same numbers,
 * which is what lets the eval harness compare against exact expected values.
 * SYNTHETIC ONLY: no names, contact details or clinical content.
 */

const SEED = 42;
const START = new Date('2025-01-01T00:00:00Z');
const END = new Date('2026-11-01T00:00:00Z'); // exclusive
const PATIENTS = 6000;

const STATES = ['TX', 'CA', 'FL', 'NY', 'IL', 'PA', 'OH', 'GA', 'NC', 'AZ'] as const;
const STATE_W = [16, 14, 12, 10, 8, 8, 8, 9, 8, 7];
const AGE_BANDS = ['18-29', '30-44', '45-59', '60+'] as const;
const AGE_W = [18, 38, 30, 14];
const CHANNELS = ['meta_ads', 'google_search', 'referral', 'organic', 'tiktok_ads'] as const;
const CHANNEL_W = [34, 26, 12, 18, 10];
const PRODUCTS = ['weight_loss', 'mens_health', 'hormone_health', 'hair_loss'] as const;
const PRODUCT_W = [48, 22, 17, 13];
const PRICE: Record<(typeof PRODUCTS)[number], number> = {
  weight_loss: 299,
  mens_health: 89,
  hormone_health: 199,
  hair_loss: 59,
};
const APPROVAL: Record<(typeof PRODUCTS)[number], number> = {
  weight_loss: 0.78,
  mens_health: 0.9,
  hormone_health: 0.82,
  hair_loss: 0.93,
};
const RETENTION: Record<(typeof PRODUCTS)[number], number> = {
  weight_loss: 0.82,
  mens_health: 0.7,
  hormone_health: 0.85,
  hair_loss: 0.75,
};
const TICKET_CATEGORIES = ['shipping', 'billing', 'prescription', 'side_effects', 'account'] as const;
const TICKET_W = [30, 25, 20, 10, 15];

/** mulberry32 — tiny deterministic PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(SEED);
const pick = <T>(items: readonly T[], weights: readonly number[]): T => {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
};
const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * 86_400_000);
const iso = (d: Date): string => d.toISOString().slice(0, 10);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Signup dates skewed toward later months (company is growing). */
function signupDate(): Date {
  const span = (END.getTime() - START.getTime()) / 86_400_000;
  const u = Math.sqrt(rand()); // density increases over time
  return addDays(START, Math.floor(u * (span - 1)));
}

type Row = readonly unknown[];

async function insertBatched(client: pg.Client, table: string, cols: readonly string[], rows: readonly Row[]): Promise<void> {
  const BATCH = 1000;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const params: unknown[] = [];
    const tuples = chunk.map((row) => {
      const ph = row.map((v) => {
        params.push(v);
        return `$${params.length}`;
      });
      return `(${ph.join(', ')})`;
    });
    await client.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES ${tuples.join(', ')}`, params);
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_ADMIN_URL;
  if (!url) {
    console.error('DATABASE_ADMIN_URL is not set — copy .env.example to .env first.');
    process.exit(1);
  }

  const patients: Row[] = [];
  const consultations: Row[] = [];
  const orders: Row[] = [];
  const tickets: Row[] = [];

  for (let id = 1; id <= PATIENTS; id++) {
    const signup = signupDate();
    patients.push([id, iso(signup), pick(STATES, STATE_W), pick(AGE_BANDS, AGE_W), pick(CHANNELS, CHANNEL_W)]);

    const product = pick(PRODUCTS, PRODUCT_W);
    const consult = addDays(signup, Math.floor(rand() * 3));
    if (consult >= END) continue;
    const approved = rand() < APPROVAL[product];
    consultations.push([id, iso(consult), product, approved ? 'approved' : 'denied']);
    if (!approved) continue;

    // First order, then monthly refills while the patient is retained.
    let orderDate = addDays(consult, 1 + Math.floor(rand() * 4));
    let isRefill = false;
    while (orderDate < END) {
      const r = rand();
      const status = r < 0.95 ? 'completed' : r < 0.98 ? 'refunded' : 'cancelled';
      const amount = round2(PRICE[product] * (0.9 + rand() * 0.2));
      orders.push([id, iso(orderDate), product, amount, isRefill, status]);
      if (rand() > RETENTION[product]) break;
      orderDate = addDays(orderDate, 28 + Math.floor(rand() * 6));
      isRefill = true;
    }

    // Support tickets for ~25% of approved patients.
    if (rand() < 0.25) {
      const n = rand() < 0.7 ? 1 : 2;
      for (let k = 0; k < n; k++) {
        const created = new Date(addDays(consult, Math.floor(rand() * 60)).getTime() + Math.floor(rand() * 86_400_000));
        if (created >= END) continue;
        const resolved = rand() < 0.95 ? new Date(created.getTime() + (1 + rand() * 71) * 3_600_000) : null;
        tickets.push([id, created.toISOString(), pick(TICKET_CATEGORIES, TICKET_W), resolved?.toISOString() ?? null]);
      }
    }
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE support_tickets, orders, consultations, patients RESTART IDENTITY CASCADE');
    await insertBatched(client, 'patients', ['id', 'signup_date', 'state', 'age_band', 'acquisition_channel'], patients);
    await insertBatched(client, 'consultations', ['patient_id', 'consult_date', 'product_line', 'outcome'], consultations);
    await insertBatched(client, 'orders', ['patient_id', 'order_date', 'product_line', 'amount_usd', 'is_refill', 'status'], orders);
    await insertBatched(client, 'support_tickets', ['patient_id', 'created_at', 'category', 'resolved_at'], tickets);
    await client.query(`SELECT setval('patients_id_seq', (SELECT MAX(id) FROM patients))`);
    await client.query('COMMIT');
    console.log(
      `✔ seeded (seed=${SEED}): ${patients.length} patients, ${consultations.length} consultations, ` +
        `${orders.length} orders, ${tickets.length} support tickets`,
    );
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e: unknown) => {
  console.error('✖ seed failed:', e);
  process.exit(1);
});
