# BFF authorization-code bridge — concrete protocol

**Status: PROPOSAL — NOT IMPLEMENTED. Requires security sign-off on the open
items in §7 before any code is written.**
**Owner decision 2026-11-09:** this is the approved cross-origin approach (see
[`OWNER_DECISIONS.md`](OWNER_DECISIONS.md)). The same-site alias alternative is
**not** selected and must not be built.

---

## 1. Why this works without weakening anything

The backend contract (v3 §B) says the existing cookies are host-only with
`HttpOnly; Path=/` and, on production/Render, `Secure; SameSite=None`. That
`SameSite=None` is what makes a **single top-level browser navigation** to the
backend's existing-session authorize endpoint carry the existing EduPay staff
cookie. We reuse it exactly as-is.

After that one navigation the browser only ever talks to its own origin
(`waitlist-admin.edupayafrica.com.ng`). All backend data calls are
**server-to-server** with `Authorization: Bearer <existing Supabase access
token>`, which `AdminSessionGuard` already accepts. So:

- no cookie `Domain` widening;
- no `SameSite` change;
- no CSRF/Origin relaxation;
- no change to the existing admin dashboard, customer app or Mission Control
  login flows;
- no second identity provider, no new user store, no `super_admin` promotion.

The BFF cookie is a **new, host-only, first-party cookie belonging only to this
app**, with `SameSite=Lax` — strictly stronger than the current shared cookie.

## 2. Topology

| Hop | Origin / transport | Credential |
|---|---|---|
| Browser → BFF | `https://waitlist-admin.edupayafrica.com.ng` (same-origin, relative URLs) | host-only `HttpOnly; Secure; SameSite=Lax; Path=/; Domain omitted` opaque session handle |
| Browser → backend (once) | top-level `GET` redirect to the existing backend origin | existing `edupay_admin_access_token` / refresh cookie (unchanged) |
| BFF → backend `/auth/exchange` | server-to-server TLS | `X-Requested-With: edupay-admin` + exact allowlisted `Origin`, one-time code + PKCE verifier |
| BFF → backend data routes | server-to-server TLS | `Authorization: Bearer <server-held Supabase access token>`; `X-Requested-With` + `Origin` for writes/exports |

Backend still runs `AdminSessionGuard → WaitlistOwnerGuard` on **every** request.
Browser JavaScript receives neither a Supabase access/refresh token nor an
owner UUID, and never sends an identity in a body, query or header.

## 3. Flow

1. **Unauthenticated browser.** BFF has no valid session. The UI shows a
   "Continue with your EduPay staff session" action and zero data. No guessing.

2. **`/api/waitlist-auth/start` (BFF).** Generates, with a CSPRNG:
   - `state` — 32 random bytes, base64url;
   - `nonce` — 32 random bytes, base64url;
   - `code_verifier` — 32 random bytes, base64url (PKCE S256);
   - `code_challenge = BASE64URL-ENCODE(SHA-256(ASCII(code_verifier)))`.

   Stores `state`, `nonce`, `code_verifier` in a short-lived handshake record
   (`HttpOnly; Secure; SameSite=Lax; Path=/api/waitlist-auth; Max-Age=300`).
   Redirects to the backend authorize endpoint with **only** `state`, `nonce`,
   `code_challenge` and an exact registered `redirect_uri`.

3. **Backend `GET /api/v1/admin/waitlist/auth/authorize`** — guarded by
   `AdminSessionGuard` then `WaitlistOwnerGuard`. It:
   - rejects any `redirect_uri` not exactly equal to the registered BFF callback;
   - rejects missing/mismatched state, nonce or malformed S256 challenge;
   - derives identity **only** from guard-populated `req.user.id` / `req.staffContext`;
   - creates a 60-second one-time code bound to the verified Auth UUID, `state`,
     `nonce`, PKCE challenge, callback URI and session generation;
   - stores **only a SHA-256 hash** of the code in the atomic single-use store;
   - redirects the browser to the BFF callback with `code` and `state` only.

4. **`/api/waitlist-auth/callback` (BFF).** Verifies `state` byte-for-byte against
   the handshake record, rejects a missing/expired/replayed handshake, then
   POSTs to the backend exchange endpoint over TLS with `Content-Type:
   application/json`, `X-Requested-With: edupay-admin`, exact `Origin`, and body
   `{ code, code_verifier, redirect_uri }`. No identity fields.

5. **Backend `POST /api/v1/admin/waitlist/auth/exchange`** — also owner-guarded.
   Atomically consumes-and-deletes the code (mark redeemed **before** responding),
   verifies code hash, TTL, state, nonce, PKCE challenge, callback URI, session
   generation, still-active Supabase session and still-active owner staff row.
   Returns the **existing** Supabase session credentials to the **BFF server
   only**. Replay, expiry or mismatch → 400/401/403. No token in a redirect.

6. **BFF creates its own session.** New opaque handle (32 random bytes). Stores
   the credentials **encrypted server-side** (AES-256-GCM, server-only 32-byte
   key from a non-`NEXT_PUBLIC_*` env var) in a durable store; sets the
   first-party cookie; discards code/verifier/handshake; rotates the handle on
   authentication and privilege changes.

7. **Data requests.** Browser calls a relative BFF route. BFF decrypts the
   server-held token, proxies to the real backend path with the bearer header,
   then returns typed JSON or the typed error envelope. Backend guards still
   authorise. `getEmailActivity` / `getCampaigns` surface 501 unchanged.

8. **Logout / revocation.** BFF destroys its session, clears its cookie,
   invalidates pending codes for that session, and calls the existing
   `POST /api/v1/admin/auth/logout` server-to-server (with the required
   `X-Requested-With` and allowlisted `Origin`). Any 401 from the backend
   destroys the BFF session immediately. Staff deactivation / password reset /
   refresh-token reuse must be covered by the revocation strategy in §7 — do
   **not** claim immediate global revocation until it is tested.

## 4. Concrete proposed parameters (all need sign-off)

| Item | Proposed value | Rationale |
|---|---|---|
| Authorization code TTL | 60 s, single-use | Bounds replay window. |
| Handshake TTL | 300 s | Bounds abandoned login attempts. |
| BFF session | opaque handle, `Max-Age=43200` (12 h), 30-min idle, 12-h absolute | Matches the existing refresh-cookie default; shorter idle. |
| Cookie flags | `HttpOnly; Secure; SameSite=Lax; Path=/; Domain omitted` | Host-only; cannot affect other EduPay origins. |
| Random values | 32 bytes, base64url, CSPRNG | State / nonce / verifier / handle. |
| PKCE | S256 | Binds the exchange to the initiator. |
| Single-use store | Redis with TLS + AUTH; `SET key hash NX EX 60`; atomic `GETDEL`/Lua consume | Must work across multiple BFF/backend instances; **no process memory**. |
| Code stored | SHA-256 hash only | A store leak must not yield usable codes. |
| Session encryption | AES-256-GCM, unique random IV per record, server-only key | No token at rest in plaintext. |
| Concurrency | exchange requests for one code serialised by the atomic consume | Prevent double redeem. |
| Rate limits | per-IP and per-session limits on `/start`, `/callback`, `/authorize`, `/exchange` | Brute-force / code-spraying mitigation. |
| Audit | `waitlist.auth.started`, `waitlist.auth.exchanged`, `waitlist.auth.rejected`, `waitlist.auth.logout` with correlation IDs only | No tokens, codes, state, owner UUID or PII in audit metadata. |

## 5. Frontend-side constraints (this repo)

- BFF lives in Next.js route handlers under `src/app/api/waitlist-auth/` and
  `src/app/api/waitlist/`; browser code uses **relative URLs only**.
- `src/lib/api/client.ts` stays server-only. `BACKEND_READY` opens only when all
  four gates in `OWNER_DECISIONS.md` are true.
- No `NEXT_PUBLIC_*` variable may hold a token, key, code or owner UUID.
- `.env.example` may list **key names and safe placeholders only**.
- Loading / empty / error / retry / pagination states are wired to the typed
  client; a backend 401 destroys the BFF session and returns the user to step 1.
- Demo data remains clearly labelled until a live query succeeds.

## 6. Backend-side requirements (other repo)

- Two new owner-guarded endpoints, added to the **existing** Waitlist Admin
  controller or a sibling controller with the same
  `@UseGuards(AdminSessionGuard, WaitlistOwnerGuard)` order.
- **Additive** `ADMIN_CORS_ORIGINS` entry for the exact BFF origin (retain all
  existing origins); the exchange POST's exact `Origin` check depends on it.
  This is an addition, not a relaxation — still needs owner approval.
- Atomic shared single-use store + its connection config (no secret in chat).
- Tests: owner allowed; other admin 403; unauthenticated 401; replay rejected;
  expired code rejected; state/nonce/PKCE/redirect_uri mismatch rejected;
  body-supplied identity ignored; no token in any browser-facing redirect.
- Staging deploy + a real service-role smoke test of one read endpoint +
  cross-app regression checks for the customer app, existing admin dashboard
  and Mission Control.

## 7. OPEN ITEMS — stop points requiring explicit sign-off

1. **Durable store choice.** Vercel serverless has no local disk. Which store
   holds (a) the atomic one-time codes and (b) the encrypted BFF sessions, and
   who provisions it? Redis/Upstash/KV are candidates; none is verified present.
   Connection details must be supplied out-of-band, never in chat.
2. **Staging hostnames.** Exact backend staging origin, exact BFF origin, and
   whether the existing EduPay staff login is reachable from that BFF in
   staging. Render host and DNS target remain UNVERIFIED.
3. **Origin allowlist.** Explicit approval to add the exact BFF origin to
   `ADMIN_CORS_ORIGINS` while retaining current entries.
4. **Session key.** Which server-only secret holds the AES-256-GCM key, how it
   rotates, and what happens to in-flight sessions on rotation.
5. **Revocation.** Exact behaviour for staff deactivation, password reset and
   refresh-token reuse detection; whether an explicit revocation event/store is
   needed beyond revalidating on each request.
6. **Rate limiting.** Concrete limits and whether an existing backend rate-limit
   guard is reusable.
7. **Rollback.** How to disable the bridge without affecting existing staff apps.

Until §7 is signed off, **no bridge route, no store and no cookie is
implemented**. The current honest "not connected" state stays.
