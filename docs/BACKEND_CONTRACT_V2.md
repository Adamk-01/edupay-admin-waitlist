# Backend integration contract — v2 delta (2026-11-09, second handoff)

**Supersedes** the status and sections noted below in
[`BACKEND_CONTRACT_V1.md`](BACKEND_CONTRACT_V1.md) (v1, preserved copy).
The canonical `BACKEND_INTEGRATION_CONTRACT.md` now holds **v3**.
Sections A, C, E, F, G, H and the types in
[`waitlist-admin-api.d.ts`](waitlist-admin-api.d.ts) are **unchanged** from v1.
Reproduced verbatim from the owner's paste except that the unclosed ` ```sql `
fence in §H is closed, and §I/§J list items were formatted as lists.

---

## New status paragraph (verbatim)

> **Status: implementation blocked / no Waitlist Admin endpoints added.** This contract records the verified backend auth boundary and a proposed typed API shape. No Waitlist Admin API endpoint exists in this repository. Implementation stopped before editing application code because the requested real overview/analytics require grouped database aggregates, while this repository has only a Supabase PostgREST client, no waitlist SQL/RPC migration or group-aggregate function, and the request forbids adding/executing a migration. Producing state distributions or time-series by loading signup rows would violate the explicit grouped-aggregate requirement; fabricating/omitting values would violate the response contract. The standalone frontend must remain in demo / not-connected mode until the owner approves an aggregate RPC/migration or an existing trusted grouped-aggregate service is supplied. The routes below remain proposals, not live endpoints.

## New §B — PROPOSAL — NOT IMPLEMENTED (verbatim, abridged only by line wrapping)

**Can the existing session cookie work across the three listed origins without `SameSite=None`? No.** They are cross-site relative to one another, and the current cookies are host-only. A Lax/Strict cookie will not be sent on cross-site `fetch` requests; a Domain attribute cannot span `onrender.com`, `vercel.app`, and `edupayafrica.com.ng`.

**Implemented option: neither.** This repository currently sets SameSite=None for production/Render. Changing shared admin cookie behavior or `ADMIN_CORS_ORIGINS` would affect existing EduPay admin applications, contrary to the isolation constraint, and cannot make a cookie cross unrelated registrable domains. No change was made.

### PROPOSAL — NOT IMPLEMENTED: existing-session authorization-code bridge

The preferred proposal is a same-origin frontend BFF that stores the existing Supabase session server-side; it is not a new identity provider or user store. The browser never receives Supabase access/refresh tokens. Do not implement this until the protocol and durable one-time store are reviewed and approved.

1. The user authenticates through the existing EduPay staff Auth flow; the backend continues to validate that Supabase Auth session and active `staff_roles` record. A proposed `GET /api/v1/admin/waitlist/auth/authorize?state=<opaque>&nonce=<opaque>&code_challenge=<S256>` endpoint would require `AdminSessionGuard` followed by `WaitlistOwnerGuard`, verify a strict allowlisted BFF callback URI, and create a short-lived authorization code bound to the verified Auth UUID, the exact `state`, `nonce`, PKCE challenge, callback URI, and session generation. Redirect the browser to the BFF callback with only code and state. No identity or role is accepted from request data.
2. Store only a hash of each authorization code in a shared atomic single-use store (proposed Redis with TLS/auth and atomic consume; **Redis/config is not present or verified in this repo**). Proposed code lifetime: 60 seconds. Consume-and-delete must be one atomic operation. Mark the code redeemed before returning a response; reject replay, expired code, mismatched callback/state/nonce/challenge, revoked session, inactive staff, and non-owner with the corresponding 400/401/403. Do not use process memory in a multi-instance deployment.
3. The BFF creates an independent random session handle for its own server-side session store; it sends the one-time code and PKCE verifier to a proposed `POST /api/v1/admin/waitlist/auth/exchange` endpoint over TLS, with `Content-Type: application/json`, `X-Requested-With: edupay-admin`, and an exact allowlisted `Origin` (the BFF origin). The exchange endpoint validates/consumes the code, revalidates the still-active Supabase session/owner, and returns the existing Supabase session credentials **only to the BFF server** over TLS. The BFF stores them encrypted server-side and discards the code/verifier. Browser JavaScript receives neither credentials nor owner UUID.
4. Browser-to-BFF requests use a host-only cookie on `waitlist-admin.edupayafrica.com.ng`: `HttpOnly; Secure; SameSite=Lax; Path=/; Domain omitted; Max-Age=43200` (proposed 12 hours, with server-side idle/absolute expiry). Rotate the opaque handle after authentication and privilege changes; protect BFF writes with Origin and CSRF defenses. This cookie belongs to the frontend BFF, not the API. Frontend implementation remains outside this repository and is **UNVERIFIED**.
5. For each API operation, the BFF proxies to the real backend path (after implemented) using `Authorization: Bearer <server-held Supabase access token>`, `X-Requested-With: edupay-admin` for writes, and exact `Origin: https://waitlist-admin.edupayafrica.com.ng`; requests use TLS. The backend still runs `AdminSessionGuard → WaitlistOwnerGuard`. Current candidate data API prefix is `/api/v1/admin/waitlist`; no such data paths exist yet. The frontend must not send authorization identity in body/query/header.
6. Logout/revocation must invalidate the BFF session, call existing `POST /api/v1/admin/auth/logout` server-to-server with the associated existing Supabase session (and required `X-Requested-With` plus allowlisted `Origin`), revoke/sign out the Supabase session, clear the BFF cookie, and invalidate all pending authorization codes for that session. Auth password reset, staff deactivation, refresh-token reuse detection, and session revocation must invalidate outstanding codes and BFF sessions; implementation needs a revocation strategy (short token lifetime plus revalidation on each API request, or an explicit revocation event/store). Do not claim immediate revocation until tested.

Required approvals/configuration: owner approval for the bridge endpoints, callback origin, atomic shared single-use store and its secret/connection configuration, BFF server-side encrypted session store, TTL/retention, and revocation approach. This proposal does not change current cookie flags or `ADMIN_CORS_ORIGINS` and is **NOT IMPLEMENTED**.

Same-site alias alternative — **PROPOSAL — NOT IMPLEMENTED**. Owner approval would be needed for: (a) DNS CNAME `api.edupayafrica.com.ng` to the actual Render service hostname (UNVERIFIED here), plus Render custom-domain attachment and TLS; (b) a backend code/config change introducing an explicit cookie-domain setting (proposed key `ADMIN_COOKIE_DOMAIN`) set to `.edupayafrica.com.ng`, with `SameSite=Lax` or `Strict` and `Secure=true`; (c) an approved `ADMIN_CORS_ORIGINS` update to include the exact custom-domain frontend origin(s), retaining existing admin origins; and (d) a reviewed rollout/rollback plan for all current staff apps. `ADMIN_COOKIE_DOMAIN` does not currently exist in code. Those cookie/CORS changes are shared-auth changes and are not made. The Vercel `edupay-admin-livid.vercel.app` origin still is not same-site with this API; it would need its own BFF or must use the custom `waitlist-admin.edupayafrica.com.ng` deployment. Render host, DNS target and frontend cookie behavior are **UNVERIFIED**.

## New §D — "Implemented endpoint manifest" paragraph (verbatim)

**None.** No waitlist routes exist in this checkout. In particular, there is no overview, registrations list/detail, analytics, CSV export, settings, audit, campaign, email activity, test-email, or consent-history endpoint. There is no backend route contract that the frontend can call today. No partial controller was added: the required overview/analytics include exact grouped time/audience/state aggregations, and the repository has no waitlist aggregate RPC or SQL connection. `src/common/supabase.module.ts:27-39` provides only a Supabase JS/PostgREST `SupabaseClient`; `package.json` declares no PostgreSQL driver; `supabase/migrations/` has no waitlist migration/function. The prompt also forbids the migration/RPC that would supply safe grouped queries. Loading signup rows and grouping in Node would violate the explicit rule. Therefore implementation must wait for permission to add and deploy a narrowly scoped aggregate RPC, or for an existing trusted aggregate endpoint to be supplied. This also blocks claiming an implementation-complete overview/analytics contract.

## New §I — validation paragraph (verbatim)

Validation run for this follow-up: `npm test -- --runInBand` PASS — 23 suites, 243 tests; `npm run lint` PASS; `npm run build` PASS; `npx tsc --noEmit --incremental false` PASS. The existing owner guard suite passed within the full run. No endpoint tests could be run because no Waitlist endpoints were implemented; therefore the requested endpoint-level authentication, query, analytics, export and 501 tests are NOT RUN. Cross-app tests remain UNVERIFIED. npm ci reported 21 audit findings (8 low, 13 moderate); dependency files were not changed.

---

## My assessment (frontend agent) — the blocker is over-constrained

See [`BACKEND_UNBLOCK_PROMPT.md`](BACKEND_UNBLOCK_PROMPT.md) and
[`AGGREGATE_RPC_PROPOSAL.sql`](AGGREGATE_RPC_PROPOSAL.sql).

Two verified facts from the live database / the public waitlist source resolve
the deadlock without any migration:

1. `waitlist_*` tables **do exist in the live Supabase DB** (verified 2026-11-09
   via `information_schema`); the migration is merely absent from the backend
   *repo*. No new tables are needed.
2. The existing `waitlist` Edge Function already performs **exact server-side
   counts without loading rows**:
   `HEAD /rest/v1/waitlist_request_log?select=id&...` with
   `Prefer: count=exact`, reading `Content-Range: */N`
   (`supabase/functions/waitlist/index.ts:417-430, 246-250`). The same pattern
   applies to `waitlist_signups`. My earlier instruction prohibited
   *materialising signup rows in Node*, not server-side counting.
3. That same source (`:222-240`) shows waitlist reads **require the service-role
   key**, because RLS has zero policies and no anon/authenticated grants. The
   backend agent must verify which key `src/common/supabase.module.ts` uses — an
   anon-key client returns empty results.

So `/registrations`, `/settings`, `/audit-logs`, `/registrations/:id`, CSV
export and the 501 stubs are implementable **today with zero migration**.
`/overview` and `/analytics` are implementable with exact filtered counts, or
cleanly with the optional read-only aggregate RPC in
`AGGREGATE_RPC_PROPOSAL.sql` once the owner approves it.
