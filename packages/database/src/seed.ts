import { createPrismaClient } from './client';
import { generateDataset, SEED } from './dataset';

/**
 * Writes the deterministic dataset with Prisma using the ADMIN connection.
 * Run via `pnpm db:seed` (or `prisma db seed`). Idempotent: truncates first.
 */
const BATCH = 5000;

function chunks<T>(rows: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += BATCH) out.push(rows.slice(i, i + BATCH));
  return out;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_ADMIN_URL;
  if (!url) {
    console.error('DATABASE_ADMIN_URL is not set — copy .env.example to .env first.');
    process.exit(1);
  }

  const ds = generateDataset();
  const prisma = createPrismaClient(url);
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('TRUNCATE support_tickets, orders, consultations, patients RESTART IDENTITY CASCADE');
        for (const data of chunks(ds.patients)) await tx.patient.createMany({ data });
        for (const data of chunks(ds.consultations)) await tx.consultation.createMany({ data });
        for (const data of chunks(ds.orders)) await tx.order.createMany({ data });
        for (const data of chunks(ds.tickets)) await tx.supportTicket.createMany({ data });
        // Patients were inserted with explicit ids — move the sequence past them.
        await tx.$executeRawUnsafe(`SELECT setval('patients_id_seq', (SELECT MAX(id) FROM patients))`);
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
    console.log(
      `✔ seeded (seed=${SEED}): ${ds.patients.length} patients, ${ds.consultations.length} consultations, ` +
        `${ds.orders.length} orders, ${ds.tickets.length} support tickets`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error('✖ seed failed:', e);
  process.exit(1);
});
