# pr-jewellers-api Technical Review

## 1. Project Snapshot
- **Purpose**: Cloudflare Worker that exposes generic table-management endpoints (create tables, CRUD records, manage product images) to back a jewellery storefront.
- **Tech Stack**: Hono on Workers (`src/index.js:1`), Zod validation, Cloudflare D1 for structured data, and R2 for object storage (bindings declared in `wrangler.toml:7` and `wrangler.toml:13`).
- **Entry point**: `src/index.js:1` wires health, image, table, and storage routers under `/api/*` plus `/assets/images/*`.
- **Middleware**: Global logger, permissive CORS, and a basic error handler via `src/middleware/setup.js:5`.
- **Core services**: `TableService` encapsulates SQL generation (`src/services/table-service.js:4`) while `StorageService` wraps R2 operations (`src/services/storage-service.js:1`).
- **Configuration**: `wrangler.toml:2` targets `backend-server` with `nodejs_compat`; D1 and R2 bindings point directly to production resources, so local work currently mutates live data.
- **Tooling**: Package scripts (`package.json:5`) run Wrangler dev/deploy and Vitest; `vitest.config.js:1` registers the Workers pool.

## 2. Runtime Architecture
1. **Request flow** – Requests enter the Hono app, pass through logger/CORS/error middleware (`src/middleware/setup.js:5`), then route into feature modules under `src/routes`.
2. **Dynamic data model** – Instead of fixed jewellery tables, clients define arbitrary tables and columns (`src/routes/table-routes.js:34`). Columns declared as `SQL_TYPES.IMAGE_URL` store JSON arrays of image paths so each record can hold multiple R2 objects.
3. **Storage coupling** – File uploads are parsed via `parseFormData` (`src/middleware/parseData.js:1`), written to R2 through `StorageService.uploadFile`, and the generated keys are persisted alongside the record. Image retrieval proxies through `/assets/images/:imageName` (`src/routes/images-route.js:7`).
4. **Operational bindings** – Wrangler attaches `DB` (Cloudflare D1) and `BUCKET` (R2). There is no secrets management, rate limiting, or auth layer between the public internet and these bindings.

## 3. API Surface
| Method | Path | Responsibility | Source |
| --- | --- | --- | --- |
| GET | `/api/health/` | Returns status/version heartbeat. | `src/routes/health-routes.js:4` |
| GET | `/assets/images/:imageName` | Streams raw objects from R2. | `src/routes/images-route.js:7` |
| POST | `/api/tables/create` | Creates a table with arbitrary columns. | `src/routes/table-routes.js:34` |
| POST | `/api/tables/:tableName/columns` | Adds a column to an existing table. | `src/routes/table-routes.js:45` |
| DELETE | `/api/tables/:tableName/columns` | Drops a column. | `src/routes/table-routes.js:60` |
| POST | `/api/tables/:tableName/records` | Accepts multipart form data, uploads images, inserts a record. | `src/routes/table-routes.js:75` |
| GET | `/api/tables/:tableName/records` | Returns every record with JSON columns deserialized. | `src/routes/table-routes.js:121` |
| PUT | `/api/tables/:tableName/records/:id` | Updates a record, handles image additions/removals. | `src/routes/table-routes.js:131` |
| DELETE | `/api/tables/:tableName/records/:id` | Deletes a record and related R2 files. | `src/routes/table-routes.js:223` |
| POST | `/api/storage/update/:key` | Rewrites a single R2 object by key. | `src/routes/storage-routes.js:8` |
| DELETE | `/api/storage/delete/:key` | Deletes an R2 object. | `src/routes/storage-routes.js:20` |

## 4. Middleware & Utilities
- **Error handling**: `src/middleware/error-handler.js:1` only special-cases `ValidationError`, otherwise emits a generic 500.
- **Table validation**: `src/middleware/validate-table.js:1` ensures a table exists and caches column types for downstream handlers.
- **Form parsing**: `src/middleware/parseData.js:1` inspects `multipart/form-data`, enforces `image/*` uploads for JSONB columns, and attaches parsed payloads to the context.
- **Image prefetch**: `src/middleware/images-remover.js:1` loads the target record before destructive operations so image keys can be purged from R2.
- **SQL generation**: `src/utils/query-builder.js:2` builds `CREATE`, `INSERT`, and `UPDATE` statements with raw string interpolation of table/column identifiers.

## 5. Testing & Quality
- `test/index.spec.js:5` still asserts “Hello World!”, which no longer reflects the actual routes; running `vitest` will fail immediately.
- There are no tests for table creation, CRUD flows, or storage handling, so regressions in jewellery flows go undetected.

## 6. Key Findings & Risks
| Severity | Issue | Impact | References | Recommendation |
| --- | --- | --- | --- | --- |
| Critical | **Unvalidated identifiers in every SQL statement.** Table names and column names from user input are injected directly into statements without quoting or allow-listing (`src/utils/query-builder.js:2`, `src/middleware/parseData.js:6`, `src/middleware/images-remover.js:5`). | Attackers can create/drop arbitrary tables or exfiltrate data by passing crafted identifiers. | `src/utils/query-builder.js:2`<br>`src/middleware/parseData.js:6`<br>`src/middleware/images-remover.js:5` | Restrict identifiers to a curated schema, escape identifiers properly, or move to predefined jewellery tables with parameterized queries. |
| High | **R2 object keys rarely match what gets stored.** Each upload computes `Date.now()` twice (once for the path stored in D1 and once for the actual R2 key) (`src/routes/table-routes.js:85` and `src/routes/table-routes.js:99`, repeated at `src/routes/table-routes.js:160` and `src/routes/table-routes.js:173`). | Millisecond drift makes the stored path differ from the uploaded key, producing broken image links and orphaned R2 files. | `src/routes/table-routes.js:85`<br>`src/routes/table-routes.js:99`<br>`src/routes/table-routes.js:160`<br>`src/routes/table-routes.js:173` | Generate the key once per file, reuse it for both the DB payload and R2 `put`, and persist metadata (size, mime) for later auditing. |
| High | **Storage update endpoint cannot succeed.** The route decorates `parseFormData`, but that middleware unconditionally queries `PRAGMA table_info(${tableName})` (`src/middleware/parseData.js:6`). Because `/api/storage/update/:key` never defines `tableName`, every request fails before reaching the handler. | `/api/storage/update/:key` is effectively dead code; editors cannot rotate hero banners or replace catalog imagery via this API. | `src/routes/storage-routes.js:8`<br>`src/middleware/parseData.js:4` | Replace `parseFormData` with a lightweight multipart parser that does not require table metadata, or update the route signature to include a table context. |
| High | **PUT handler exits early on missing JSON columns.** The loop at `src/routes/table-routes.js:190` returns from the entire handler when the first JSON column lacks data. | Updates against records that do not yet store images (common for new jewellery entries) will hang or return empty responses. | `src/routes/table-routes.js:190` | Change the `return` to `continue`, and add integration tests for records without prior image arrays. |
| High | **No authentication, authorization, or rate limiting.** All endpoints (table creation, column mutations, record deletion, raw R2 deletes) are exposed publicly with permissive CORS (`src/index.js:10`). | Any visitor can drop columns, delete product images, or tamper with store data. Wrangler currently points to production D1/R2 bindings, so abuse hits live systems. | `src/index.js:10`<br>`wrangler.toml:7`<br>`wrangler.toml:13` | Introduce authentication (HMAC/JWT) and role-based rules, rate-limit requests, and create staging bindings rather than hitting production during development. |
| Medium | **DB↔R2 operations are not atomic.** Uploads to R2 happen before the D1 write succeeds, and failures are not rolled back (`src/routes/table-routes.js:83`). Deletes remove files even if the DB update fails later in the handler. | Leads to orphaned files or dangling DB references, bloating storage costs and breaking galleries. | `src/routes/table-routes.js:83`<br>`src/routes/table-routes.js:205` | Stage uploads under a temporary prefix, commit DB changes first, then finalize storage (or queue clean-up tasks when an operation aborts). |
| Medium | **Verbose logging leaks sensitive payloads.** Image fetches log entire R2 objects (`src/routes/images-route.js:12`), and table deletes log raw D1 responses (`src/services/table-service.js:94`). | Jewellery assets and customer data may enter Workers logs, increasing PII exposure. | `src/routes/images-route.js:12`<br>`src/services/table-service.js:94` | Remove or redact logs in production builds; rely on structured metrics instead. |
| Low | **Automated tests are stale (“Hello World”).** The Vitest suite asserts a response body that no endpoint returns anymore (`test/index.spec.js:5`). | `npm test` always fails, preventing CI from catching real regressions. | `test/index.spec.js:5` | Rewrite tests around the health endpoint, table CRUD happy paths, and negative validation/auth cases. |

## 7. Missing Jewellery-Specific Functionality
- **Merchandise catalog**: No canonical `products`, `collections`, `materials`, or pricing tables; the storefront cannot list rings, necklaces, or sets.
- **Inventory & availability**: No stock tracking, variant matrix, or lead-time information.
- **Customer experience**: Absent flows for carts, checkout, wishlists, appointments, store locator, testimonials, after-sales care.
- **Content management**: No hero banners, lookbooks, gemstone education articles, or promo campaign endpoints; editors must craft raw tables manually.
- **Analytics & personalization**: No event tracking, conversion metrics, or recommendation data.
- **Governance**: Lacks role-based access, approval workflows, or audit logs needed for luxury retail compliance.

## 8. Improvement Opportunities
1. **Lock down the schema**: Replace generic table builders with predefined jewellery domain tables or validate identifiers before reaching `QueryBuilder`.
2. **Consolidate image handling**: Compute a UUID-based key, reuse it for R2 and D1, persist mime/size metadata, and add signed URLs or stronger caching headers.
3. **Add authentication & RBAC**: Introduce Workers KV/Durable Objects or an external IdP to issue signed tokens so only admins mutate catalog data.
4. **Implement pagination, filtering, and search**: `/api/tables/:tableName/records` currently dumps every row; add query params for pagination, sorting, gemstone type, metal, price bands, etc.
5. **Domain-focused endpoints**: Expose `/api/products`, `/api/collections`, `/api/orders`, `/api/appointments`, `/api/content` backed by migrations rather than run-time table creation.
6. **Strengthen validation**: Extend Zod schemas to sanitize column names, enforce max lengths, require numeric types for price/weight, and validate JSON payloads before persisting.
7. **Transactional safety**: Wrap DB writes and R2 updates in compensating logic or leverage Workers Queues to delete orphaned files when a DB write fails.
8. **Observability**: Replace console logs with structured events, emit metrics per route, and surface failures via alerts.
9. **Configuration hygiene**: Honor `src/config/app-config.js:1` (CORS allowlist, payload limits) instead of hardcoding `cors()` defaults.
10. **Testing roadmap**: Build Vitest suites for each router, especially around multipart uploads, image delta updates, and failure paths.

## 9. Suggested Next Steps
1. **Stabilize production** – Introduce auth, identifier sanitization, and consistent file keys before exposing the API publicly.
2. **Design the jewellery schema** – Workshop product, collection, inventory, content, and appointment models, then codify them via migrations.
3. **Implement customer-facing endpoints** – Build read-optimized APIs (catalog listings, product detail, search, recommendations) separate from admin CRUD flows.
4. **Expand QA** – Replace placeholder tests with real integration coverage and add CI that runs `wrangler d1`/`wrangler r2` mocks before each deploy.
5. **Operationalize** – Configure staging bindings, secret management, and observability (Workers Logs, alerts) so deployments are safe and traceable.

---
Use this review file as a living backlog for closing the gaps between the current generic backend and the feature set a jewellery storefront expects.
