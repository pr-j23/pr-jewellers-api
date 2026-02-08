# Next-Gen Worker

This folder contains the modernized API that will eventually replace the legacy `src/` worker. Key ideas:

- **Isolation**: Runs as its own Cloudflare Worker so you can develop/deploy without touching the existing service.
- **Tenant awareness**: Middleware loads tenant configuration (DB, bucket, feature flags) before hitting API routes.
- **Domain focus**: Starts with `/api/products` while leaving collections/appointments/content for later milestones.

## Quick Start
```bash
cd next-gen
npm install
npm run dev   # wrangler dev
```

Set the appropriate bindings (D1, R2, secrets) in `wrangler.toml` or via `wrangler secret`. Each request must include a numeric `X-Tenant-ID` (e.g., `1001`) and a matching `X-API-Key`.

## Structure
- `src/index.js` – Hono app entry point.
- `src/middleware` – auth, tenant registry, validation helpers.
- `src/routes` – domain routers (currently products + health).
- `src/services` – D1 + storage helpers scoped per tenant.
- `docs/` – additional design references, if needed.

Keep this tree independent so you can dual-run legacy + next-gen until migration completes.
