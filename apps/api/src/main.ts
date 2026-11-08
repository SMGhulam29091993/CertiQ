import { createApp } from './app';
import { loadConfig } from './config';
import { buildContainer } from './container';

/**
 * Boot order (constitution.md › Architectural Constraints):
 * validate config → build container (registry integrity check) → verify DB → listen.
 * Any failure exits non-zero before serving a single request.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const container = buildContainer(config);

  const db = await container.repository.ping();
  if (!db.ok) {
    console.error(`✖ ${db.error.message}`);
    process.exit(1);
  }

  const app = createApp(container, config.WEB_ORIGIN);
  app.listen(config.API_PORT, () => {
    console.log(
      `✔ CertiQ API on :${config.API_PORT} — registry v${container.registry.version()}, ` +
        `${container.registry.listMetrics().length} certified metrics`,
    );
  });
}

main().catch((e: unknown) => {
  console.error('✖ startup failed:', e);
  process.exit(1);
});
