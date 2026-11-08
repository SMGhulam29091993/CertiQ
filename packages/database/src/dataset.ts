/**
 * Deterministic synthetic telehealth dataset — pure, no I/O.
 * Same seed → same rows → same numbers, which is what lets the eval harness compare against
 * exact values. Kept separate from the Prisma writer so it can be unit-tested without a DB.
 * SYNTHETIC ONLY: no names, contact details or clinical content.
 */

export const SEED = 42;
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
type Product = (typeof PRODUCTS)[number];
const PRICE: Record<Product, number> = { weight_loss: 299, mens_health: 89, hormone_health: 199, hair_loss: 59 };
const APPROVAL: Record<Product, number> = { weight_loss: 0.78, mens_health: 0.9, hormone_health: 0.82, hair_loss: 0.93 };
const RETENTION: Record<Product, number> = { weight_loss: 0.82, mens_health: 0.7, hormone_health: 0.85, hair_loss: 0.75 };
const TICKET_CATEGORIES = ['shipping', 'billing', 'prescription', 'side_effects', 'account'] as const;
const TICKET_W = [30, 25, 20, 10, 15];

export interface PatientRow {
  id: number;
  signupDate: Date;
  state: string;
  ageBand: string;
  acquisitionChannel: string;
}
export interface ConsultationRow {
  patientId: number;
  consultDate: Date;
  productLine: string;
  outcome: 'approved' | 'denied';
}
export interface OrderRow {
  patientId: number;
  orderDate: Date;
  productLine: string;
  amountUsd: number;
  isRefill: boolean;
  status: 'completed' | 'refunded' | 'cancelled';
}
export interface TicketRow {
  patientId: number;
  createdAt: Date;
  category: string;
  resolvedAt: Date | null;
}
export interface Dataset {
  patients: PatientRow[];
  consultations: ConsultationRow[];
  orders: OrderRow[];
  tickets: TicketRow[];
}

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

const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * 86_400_000);
const round2 = (n: number): number => Math.round(n * 100) / 100;

export function generateDataset(seed: number = SEED): Dataset {
  const rand = rng(seed);
  const pick = <T>(items: readonly T[], weights: readonly number[]): T => {
    const total = weights.reduce((s, w) => s + w, 0);
    let r = rand() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return items[i]!;
    }
    return items[items.length - 1]!;
  };
  /** Signup dates skewed toward later months (company is growing). */
  const signupDate = (): Date => {
    const span = (END.getTime() - START.getTime()) / 86_400_000;
    return addDays(START, Math.floor(Math.sqrt(rand()) * (span - 1)));
  };

  const ds: Dataset = { patients: [], consultations: [], orders: [], tickets: [] };

  for (let id = 1; id <= PATIENTS; id++) {
    const signup = signupDate();
    ds.patients.push({
      id,
      signupDate: signup,
      state: pick(STATES, STATE_W),
      ageBand: pick(AGE_BANDS, AGE_W),
      acquisitionChannel: pick(CHANNELS, CHANNEL_W),
    });

    const product = pick(PRODUCTS, PRODUCT_W);
    const consult = addDays(signup, Math.floor(rand() * 3));
    if (consult >= END) continue;
    const approved = rand() < APPROVAL[product];
    ds.consultations.push({ patientId: id, consultDate: consult, productLine: product, outcome: approved ? 'approved' : 'denied' });
    if (!approved) continue;

    // First order, then monthly refills while the patient is retained.
    let orderDate = addDays(consult, 1 + Math.floor(rand() * 4));
    let isRefill = false;
    while (orderDate < END) {
      const r = rand();
      const status = r < 0.95 ? 'completed' : r < 0.98 ? 'refunded' : 'cancelled';
      ds.orders.push({ patientId: id, orderDate, productLine: product, amountUsd: round2(PRICE[product] * (0.9 + rand() * 0.2)), isRefill, status });
      if (rand() > RETENTION[product]) break;
      orderDate = addDays(orderDate, 28 + Math.floor(rand() * 6));
      isRefill = true;
    }

    // Support tickets for ~25% of approved patients.
    if (rand() < 0.25) {
      const n = rand() < 0.7 ? 1 : 2;
      for (let k = 0; k < n; k++) {
        const createdAt = new Date(addDays(consult, Math.floor(rand() * 60)).getTime() + Math.floor(rand() * 86_400_000));
        if (createdAt >= END) continue;
        const resolvedAt = rand() < 0.95 ? new Date(createdAt.getTime() + (1 + rand() * 71) * 3_600_000) : null;
        ds.tickets.push({ patientId: id, createdAt, category: pick(TICKET_CATEGORIES, TICKET_W), resolvedAt });
      }
    }
  }
  return ds;
}
