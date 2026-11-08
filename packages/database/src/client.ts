import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

/**
 * The single way to construct a Prisma client in this repo (Prisma 7: driver adapter required).
 * Callers decide the connection string — the API passes DATABASE_READONLY_URL, the seed script
 * passes DATABASE_ADMIN_URL. Nothing here reads env, so the role is always explicit at the call site.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5 }) });
}

export { PrismaClient };
