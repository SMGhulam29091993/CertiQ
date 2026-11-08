import { describe, expect, it } from 'vitest';
import { generateDataset } from './dataset';

describe('generateDataset', () => {
  it('certified-metric-tool.UT07 — is deterministic for seed=42 (eval ground truth depends on it)', () => {
    const ds = generateDataset();
    expect({
      patients: ds.patients.length,
      consultations: ds.consultations.length,
      orders: ds.orders.length,
      tickets: ds.tickets.length,
    }).toEqual({ patients: 6000, consultations: 5994, orders: 17518, tickets: 1434 });
    expect(generateDataset()).toEqual(ds);
  });

  it('certified-metric-tool.UT08 — contains no identifying fields', () => {
    const keys = new Set(Object.keys(generateDataset().patients[0]!));
    expect([...keys].sort()).toEqual(['acquisitionChannel', 'ageBand', 'id', 'signupDate', 'state']);
  });
});
