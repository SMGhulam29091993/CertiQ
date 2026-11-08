import type { Catalog } from '../lib/api';

export function CatalogPanel({ catalog }: { catalog: Catalog | null }) {
  return (
    <aside className="catalog" aria-label="Certified metrics">
      <p className="eyebrow">
        Certified metrics {catalog ? <span className="muted">· registry v{catalog.registryVersion}</span> : null}
      </p>
      {!catalog && <p className="muted">Catalog unavailable — is the API running?</p>}
      <ul>
        {catalog?.metrics.map((m) => (
          <li key={m.id}>
            <div className="cat-row">
              <span className="cat-label">{m.label}</span>
              <span className="cat-unit">{m.unit}</span>
            </div>
            <p className="cat-desc">{m.description}</p>
            <p className="cat-meta">
              <code>{m.id}</code> v{m.version} · owner {m.owner}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
