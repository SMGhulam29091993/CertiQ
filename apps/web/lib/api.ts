import type { AskResponse } from '@certiq/contracts';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Envelope<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface CatalogMetric {
  id: string;
  version: string;
  label: string;
  description: string;
  unit: 'count' | 'usd' | 'ratio' | 'hours';
  dimensions: string[];
  owner: string;
  synonyms: string[];
}

export interface Catalog {
  registryVersion: string;
  metrics: CatalogMetric[];
  dimensions: { id: string; label: string; values?: string[] }[];
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !body?.success || body.data === undefined) {
    throw new Error(body?.message ?? `Request failed (${res.status})`);
  }
  return body.data;
}

export const api = {
  ask: (question: string) => call<AskResponse>('/ask', { method: 'POST', body: JSON.stringify({ question }) }),
  catalog: () => call<Catalog>('/metrics'),
};
