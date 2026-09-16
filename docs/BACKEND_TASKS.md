# Backend Tasks — `pr-jewellers-api`

Tracking file for the backend work needed to complete the Mailgun secret-exposure fix.

This file is maintained in `pr-jewellers-api` and tracks the backend work for the Mailgun secret-exposure fix.

> Context: the frontend previously called `api.mailgun.net` directly from the browser using
> `VITE_MAILGUN_*` env vars, which are inlined into the client bundle and therefore public.
> The frontend has been changed (`pr-jewellers` PR #94) to POST the contact form to the backend
> instead. The backend must now hold the Mailgun secret and make the email call server-side.

## Frontend contract (already implemented on `pr-jewellers`)

- The frontend POSTs to `${API_CONFIG.hostUrl}/contact` — resolved from
  `src/services/apiConfig.ts` (`hostUrl: 'https://backend-server.pavanjewellers.in'`).
- Method: `POST`
- `Content-Type: application/json`
- Body: `{ "name": string, "email": string, "message": string }`
- On success the frontend uses `response.data` (any JSON is fine; a `{ success: true }` is enough).
- On failure it reads `response.data.message` for the toast text, so return
  `{ "message": "<reason>" }` with a non-2xx status on errors.

> ⚠️ If you choose a different route than `/contact`, update the URL in
> `src/services/contactApi.ts` on the frontend to match.

## Completed

### 1. Contact endpoint

- [x] Implement `POST /contact` accepting JSON `{ name, email, message }`.
- [x] Validate all three fields are present and non-empty; return `400` with `{ message }` otherwise.
- [x] Validate the email address format.
- [x] Read Mailgun config from **server** env vars (NOT prefixed `VITE_`):
  - `MAILGUN_API_KEY`
  - `MAILGUN_DOMAIN_NAME`
  - `MAILGUN_SENDING_MAIL`
  - `STORE_CONTACT_EMAIL`
- [x] Call Mailgun `POST https://api.mailgun.net/v3/${MAILGUN_DOMAIN_NAME}/messages` with
  HTTP Basic auth (`username: 'api'`, `password: MAILGUN_API_KEY`), multipart form body:
  - `from` = `MAILGUN_SENDING_MAIL`
  - `to` = `STORE_CONTACT_EMAIL`
  - `subject` = `Contact Form Submission`
  - `text` = `message`
  - `reply-to` = `email`
- [x] Return `{ success: true }` (2xx) on success.
- [x] Return `{ message }` with a non-2xx status when sending fails.
- [x] Return `500` when the Mailgun configuration is incomplete.

### 2. Security & CORS

- [x] Configure CORS to allow the production frontend:
  - `https://pavanjewellers.in`
- [x] Configure CORS to allow the Cloudflare Pages preview:
  - `https://pr-jewellers.pages.dev`
- [x] Verify an untrusted origin is not allowed.
- [x] Confirm no real Mailgun credentials are present in the backend repository.
- [x] Confirm there are no `VITE_MAILGUN_*` references in the backend repository.

### 3. Testing & verification

- [x] Test successful `POST /contact`.
- [x] Test missing/empty required fields return `400`.
- [x] Test invalid email returns `400`.
- [x] Test incomplete Mailgun configuration returns `500`.
- [x] Test Mailgun failure returns `500`.
- [x] Test Mailgun request URL and Basic authentication.
- [x] Test Mailgun request fields.
- [x] Test allowed CORS origins.
- [x] Test rejection of an untrusted CORS origin.
- [x] Test suite passes: **13/13**.
- [x] Run `git diff --check`.
- [x] Verify `wrangler.toml` has no unrelated compatibility-date change.

---

## Pending

### 4. Mailgun credentials

- [ ] Rotate the existing Mailgun API key — the old key is already exposed in previously
  deployed frontend bundles and must be considered compromised.
- [ ] Store the new `MAILGUN_API_KEY` as a backend server secret.
- [ ] Configure `MAILGUN_DOMAIN_NAME` on the backend host.
- [ ] Configure `MAILGUN_SENDING_MAIL` on the backend host.
- [ ] Configure `STORE_CONTACT_EMAIL` on the backend host.
- [ ] Verify the backend can access the configured values without exposing them.

### 5. Backend deployment

- [ ] Configure all required Cloudflare Worker secrets.
- [ ] Deploy the updated backend.
- [ ] Verify `POST /contact` is available at:
  `https://backend-server.pavanjewellers.in/contact`
- [ ] Verify production CORS after deployment.
- [ ] Verify Cloudflare Pages preview CORS after deployment.
- [ ] Verify a real contact-form submission reaches the store email.

### 6. Frontend end-to-end verification

- [ ] Submit the contact form from a frontend preview deployment.
- [ ] Confirm the browser request goes to `/contact`.
- [ ] Confirm the browser does not call `api.mailgun.net`.
- [ ] Confirm no Mailgun credentials are present in the request payload.
- [ ] Confirm no Mailgun credentials are present in the frontend bundle.

### 7. Frontend Cloudflare configuration

- [ ] Verify frontend PR #94 is deployed against the working backend.
- [ ] Remove all `VITE_MAILGUN_*` variables from Cloudflare Pages environment settings.
- [ ] Confirm the frontend no longer depends on the old Mailgun variables.

### 8. Abuse protection

- [ ] Evaluate rate limiting for `POST /contact`.
- [ ] Consider Cloudflare Turnstile or another CAPTCHA/anti-spam mechanism.
- [ ] Add protection if required before exposing the endpoint broadly.

---

## Deployment Order

1. Rotate the exposed Mailgun API key.
2. Configure the new backend secrets.
3. Deploy the backend.
4. Verify `POST /contact` on the deployed backend.
5. Run frontend preview E2E verification.
6. Merge/deploy frontend PR #94.
7. Remove `VITE_MAILGUN_*` variables from Cloudflare Pages.
8. Verify the production contact form.
9. Confirm no Mailgun credentials are shipped to the browser.

> Do not merge/deploy the frontend production change before the backend `/contact`
> endpoint is deployed and verified.

---

## Current Status

| Area | Status |
|---|---|
| Backend implementation | ✅ Completed |
| Backend tests | ✅ 13/13 passing |
| CORS configuration | ✅ Completed |
| Repository security checks | ✅ Completed |
| Mailgun credential rotation | ⏳ Pending |
| Backend secrets configuration | ⏳ Pending |
| Backend deployment | ⏳ Pending |
| Frontend E2E verification | ⏳ Pending |
| Frontend Cloudflare variable cleanup | ⏳ Pending |
| Abuse protection | ⏳ Pending / Optional |
| Overall task | 🟡 In progress |
