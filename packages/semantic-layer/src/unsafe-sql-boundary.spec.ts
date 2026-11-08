import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Architecture test (ADR-0006): Prisma's raw-unsafe APIs may appear only in the files that are
 * reviewed for it. Anything else using them fails the build — the rule is enforced, not just written.
 */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ALLOWED = new Set([
  'packages/semantic-layer/src/prisma-metric-repository.ts', // metric queries: registry identifiers + bound params
  'packages/database/src/seed.ts', // TRUNCATE + setval on the admin connection
]);
const SKIP = new Set(['node_modules', 'generated', '.next', '.turbo', 'dist', '.git']);
const PATTERN = /\$(queryRawUnsafe|executeRawUnsafe)\s*[<(]/;

function* tsFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* tsFiles(full);
    else if (/\.tsx?$/.test(name) && !name.endsWith('.spec.ts')) yield full;
  }
}

describe('raw-unsafe SQL boundary', () => {
  it('certified-metric-tool.UT09 — only allow-listed files call $queryRawUnsafe / $executeRawUnsafe', () => {
    const offenders = [...tsFiles(join(ROOT, 'apps')), ...tsFiles(join(ROOT, 'packages'))]
      .map((f) => relative(ROOT, f))
      .filter((rel) => PATTERN.test(readFileSync(join(ROOT, rel), 'utf8')) && !ALLOWED.has(rel));
    expect(offenders).toEqual([]);
  });
});
