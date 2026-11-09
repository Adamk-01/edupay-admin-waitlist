# Handoff status — after receiving the backend integration contract

**Date:** 2026-11-09
**Trigger:** the project owner pasted `BACKEND_INTEGRATION_CONTRACT.md` and
`waitlist-admin-api.d.ts` from the agent with access to `Adamk-01/edupay-backend`.

> **CURRENT STATE: see §6.** Sections 1–5 are the historical record of the v1,
> v2 and v3 turns in order. The current canonical backend contract is
> `docs/BACKEND_INTEGRATION_CONTRACT.md` (v3).

## 1. What the contract actually says (the headline)

> "**Status: handoff / implementation gap.** … It does **not** claim that any
> Waitlist Admin API endpoint exists: none was found in this repository. The
> standalone frontend must remain in demo / not-connected mode until these
> routes are implemented and deployed."

So the requested "fix" **did not happen**. The backend agent:

| Item | Result |
|---|---|
| `AdminSessionGuard` | ✅ Verified: `src/admin/admin-session.guard.ts:92-162`; bearer or `edupay_admin_access_token` / refresh cookie; Supabase `getUser`; active `staff_roles` lookup; server-populated `req.user` / `req.staffContext`. |
| `WaitlistOwnerGuard` | ✅ Verified: `src/admin/waitlist-owner.guard.ts:11-34`; reads `WAITLIST_ADMIN_OWNER_USER_ID` (key name only), compares session UUID, ignores body identity. |
| Guard tests | ✅ `admin-session.guard.spec.ts` 2 passed; `waitlist-owner.guard.spec.ts` 10 passed (owner allowed, other admin denied, blank/invalid config denied, missing identity denied, body-supplied owner ignored). |
| Guard order on endpoints | ⚠️ **Zero endpoints to verify.** No Waitlist Admin controller/service/route exists. Future controller must use `@UseGuards(AdminSessionGuard, WaitlistOwnerGuard)` in that order. |
| Waitlist Admin endpoints | ❌ **None implemented.** The manifest in §D is explicitly "proposed future route shape (NOT IMPLEMENTED)". |
| Cross-origin session | ❌ **Neither option implemented.** Answer to "can the cookie work without `SameSite=None`?" is **No**. The repo already sets `SameSite=None` on Render/production (host-only cookies). Agent refused to change shared cookie/CORS because it would affect existing admin apps — correct per the isolation rule. BFF/session-bridge protocol left for design + security review; "do not improvise an endpoint from this document". |
| Owner config | ✅ `WAITLIST_ADMIN_OWNER_USER_ID`; owner remains existing `admin`, no `super_admin` promotion; no body-supplied identity trust. |
| CSRF | Custom `X-Requested-With: edupay-admin` + exact allowlisted `Origin` on non-GET; no synchronizer token, no `Sec-Fetch-Site`. |
| Migrations | ❌ DDL proposals only, **NOT EXECUTED** (consent events, campaigns, recipients, email events, unsubscribes). |
| Backend validation | ✅ `npm test -- --runInBand` 23 suites / 243 tests PASS; lint, build, `tsc --noEmit` PASS. |
| Commits / pushes / deploys | ❌ None. |

**Consequence:** the success criterion ("a real, secure, owner-only dashboard using
existing EduPay infrastructure, not a static demo with fabricated data") is
**still not achievable**. There is no API to call and no approved session
architecture. I did not invent either.

## 2. What I did in this turn (safe, verifiable, no fabricated data)

| File | Purpose |
|---|---|
| `docs/BACKEND_INTEGRATION_CONTRACT.md` | Contract reproduced verbatim (one correction: closed the unclosed ` ```sql ` fence in §H). |
| `docs/waitlist-admin-api.d.ts` | Proposed types reproduced verbatim, for provenance. |
| `docs/BACKEND_FOLLOWUP_PROMPT.md` | Short prompt to send back to the backend agent so it actually implements the endpoints. |
| `docs/HANDOFF_STATUS.md` | This file. |
| `src/lib/api/contract.ts` | Runtime-safe copy of the proposed types + `WAITLIST_ADMIN_BASE_PATH`, clearly marked PROPOSED / NOT LIVE. |
| `src/lib/api/features.ts` | Honest availability map from contract §E: `dataSupported` vs `endpointAvailable: false`, reasons and prerequisites for every requested feature. |
| `src/lib/api/client.ts` | Server-only, gated typed client: `BACKEND_IMPLEMENTED = false`, strict filter allowlist + validation, pagination caps, typed error envelope, bounded retry, UUID validation. **Every method throws before any network call.** No fabricated responses. |
| `src/components/admin-shell.tsx` | Extracted sidebar/topbar; nav items are now **real Next.js links** with `aria-current`, replacing the old `setActive()` heading-only behaviour. Removed the fabricated `2.4k` badge. |
| `src/app/page.tsx` | Uses the shared shell; real links for View registrations / New campaign / View all / View project setup; non-dismissible demo label and honest live-mode state preserved. |
| `src/app/[section]/page.tsx` | Six real routes (`/registrations`, `/analytics`, `/campaigns`, `/email-activity`, `/exports`, `/settings`), each showing an honest "no live data" state with the exact reason and prerequisites from §E. No invented numbers. |
| `src/app/admin.css` | Minimal styles so the new links keep the existing visual identity. |
| `src/app/layout.tsx` | Imports the small additive stylesheet. |

**No auth wiring, no BFF, no session bridge, no cookie/CORS change, no endpoint
call, no migration, no deployment, no commit and no push was performed.**

## 3. What remains (blocked, in order) — historical v1 view; see §6 for today

> Item 1 was completed **locally** in v3 (not deployed). Items 2–5 still apply.

1. **Backend endpoints** — the backend agent must implement the §D routes with
   `@UseGuards(AdminSessionGuard, WaitlistOwnerGuard)` in that order, strict
   validation, pagination caps, CSV cap + `waitlist.exported` audit entry, and
   tests. Use `docs/BACKEND_FOLLOWUP_PROMPT.md`. ✅ Done locally in v3.
2. **Session architecture decision** — owner must approve either (a) a same-site
   API alias `api.edupayafrica.com.ng` (DNS/proxy + cookie `Domain` change that
   also affects the existing dashboard), or (b) a separately reviewed BFF
   authorization-code/session-bridge protocol. The contract explicitly says not
   to improvise it. Until approved, **no `SameSite=None` change, no cookie-scope
   weakening and no Origin/CSRF relaxation**.
3. **Schema permission** — campaigns, email events, unsubscribes and consent
   history need new tables; the §H DDL is a proposal and requires explicit
   approval before any migration.
4. **Vercel scopes** — still `Access denied` for project/deployment/domain/env
   reads, so deployment preparation cannot be verified.
5. **Frontend wiring** — once 1–2 are done: open the `BACKEND_READY` gate in
   `src/lib/api/client.ts` (only after deployment + session approval + a real
   live query), implement BFF route handlers, then connect real
   loading/empty/error/retry/pagination states to the typed client.

## 4. Verification (all executed in this checkout)

| Check | Result |
|---|---|
| `npm run lint` | ✅ 0 errors / 0 warnings |
| `npx tsc --noEmit` | ✅ pass |
| `npm run build` | ✅ pass — 10 static pages: `/`, `/_not-found`, and 6 SSG section routes via `generateStaticParams` |
| Built HTML: section routes | ✅ all 6 contain "Why this page is empty" + `NOT CONNECTED` + the contract reason; **none** contains the fabricated `2,450` |
| Built HTML: `/` | ✅ non-dismissible demo banner present, real nav links (`/registrations`, `/analytics`, `/campaigns`, `/email-activity`, `/exports`, `/settings`) present |
| Secret scan of new docs/code | ✅ no tokens, keys, passwords or long hex values |
| `npm audit` | critical 0; 1 high (`postcss` bundled in Next) + 7 moderate — full fix requires the Next 16 major, not approved |

No commits, pushes, deploys, DNS changes, migrations or auth/cookie/CORS
changes were performed.

## 5. Second backend handoff (v2) — new blocker, and the unlock

The backend agent replied again with **still zero endpoints**, now citing a new
blocker: its repo has only a Supabase JS/PostgREST client, no waitlist migration
and no aggregate RPC, so `/overview` and `/analytics` would require either
loading rows into Node (prohibited) or a migration (prohibited). It also
returned a detailed `PROPOSAL — NOT IMPLEMENTED` for an authorization-code
session bridge (Redis-backed single-use codes, PKCE, BFF first-party cookie,
revocation) and for the same-site alias. Tests again: 23 suites / 243 tests,
lint/build/tsc pass; no endpoint tests could run.

Full delta: [`BACKEND_CONTRACT_V2.md`](BACKEND_CONTRACT_V2.md).

**Assessment: the blocker is over-constrained.** Verified from the public
waitlist source and the live DB:

| Claim | Finding |
|---|---|
| "no waitlist schema" | The **live Supabase DB has the three `waitlist_*` tables** (verified via `information_schema`); the migration is merely absent from the backend repo. No new tables are needed. |
| "grouped aggregates need an RPC/migration" | The existing `waitlist` Edge Function already does exact server-side counts with `HEAD /rest/v1/...?select=id&<filters>` + `Prefer: count=exact` → `Content-Range: */N` (`supabase/functions/waitlist/index.ts:417-430, 246-250`). No row payload, no Node aggregation, no migration. My earlier instruction prohibited **materialising rows in Node**, not server-side counting. |
| "Supabase client can read signups" | That same source (`:222-240`) uses the **service-role key** because RLS has zero policies and no anon/authenticated grants. The backend must verify which key `src/common/supabase.module.ts:27-39` uses — an anon-key client returns zero rows. |

Therefore `/registrations`, `/registrations/:id`, `/settings`, `/audit-logs`,
CSV export and the two 501 stubs are implementable **today with no migration**;
overview/analytics are implementable with exact filtered counts, or cleanly via
the optional read-only aggregate RPC in
[`AGGREGATE_RPC_PROPOSAL.sql`](AGGREGATE_RPC_PROPOSAL.sql) (PROPOSAL ONLY,
**NOT EXECUTED**, requires explicit owner permission).

Artefacts added this turn:

- `docs/BACKEND_CONTRACT_V2.md` — verbatim delta + assessment.
- `docs/AGGREGATE_RPC_PROPOSAL.sql` — optional, narrowly scoped, read-only,
  RLS-safe aggregate functions with `REVOKE ... FROM PUBLIC, anon, authenticated`.
  **Not executed.** I have Supabase connector access but will not run any
  migration without your explicit permission.
- `docs/BACKEND_UNBLOCK_PROMPT.md` — pasteable prompt that clarifies the
  count-query interpretation, requires the service-role key check, and asks for
  real endpoints plus a minimum fallback of `GET /settings`.

**Still awaiting owner decisions:** (1) approve the optional aggregate RPC
migration, or confirm the no-migration count approach; (2) approve a session
option (BFF authorization-code bridge with Redis, or same-site alias with DNS +
`ADMIN_COOKIE_DOMAIN`); (3) approve campaign/consent/event schema DDL;
(4) grant Vercel read scopes. Until then nothing is deployed or applied.

## 6. Third backend handoff (v3) — endpoints implemented locally, NOT deployed

The backend agent finally implemented the read endpoints. Its accompanying
summary: *"Implemented locally on `arena/f123aa73-edupay-backend`; nothing was
committed, pushed, or deployed. The new endpoints reuse the service-role client
and existing guards … The tests use mocked Supabase queries. Live database
behavior and cross-app regressions remain UNVERIFIED. The session bridge and
same-site alias are still proposals, not implemented."*

### What changed in v3 (verified from the pasted contract)

| Area | v3 state |
|---|---|
| Guard order | ✅ `src/admin/waitlist-admin.controller.ts:109-111` applies `@UseGuards(AdminSessionGuard, WaitlistOwnerGuard)` at controller level; `admin.module.ts` registers controller/service/guards. No other controller changed. |
| Implemented routes | ✅ `GET /overview`, `/registrations`, `/registrations/:id`, `/analytics`, `/registrations/export.csv`, `/settings`, `/audit-logs`; `/email-activity` and `/campaigns` return 501 `FEATURE_UNAVAILABLE`. |
| Aggregates | ✅ Exact PostgREST `HEAD` + `count=exact` from the `SUPABASE_SERVICE_ROLE_KEY` client — **no migration, no RPC, no rows materialised in Node**. 30 daily buckets; 37 state/FCT labels + other/unspecified; max 366 days, concurrency 8; rates are `null` on zero denominator. |
| CSV | ✅ 5,000-row hard cap → `EXPORT_LIMIT_EXCEEDED`, deterministic 500-row ranges + count recheck, RFC 4180 quoting/CRLF/UTF-8, formula-injection escaping, `waitlist.exported` audit row with filter **names** + row count only. |
| PII | ✅ Explicit `select` allowlist; no `email_key`, `token_hash`, raw tokens, owner UUID or config values. Export audit actor from `@CurrentUser()`. |
| Tests | ✅ Targeted 2 suites / 24 tests; full 24 suites / 257 tests; lint, build, `tsc --noEmit`, `.d.ts` check all PASS. **Mocked** Supabase queries. |
| NOT done | ❌ No commit/push/deploy, no migration, no cookie/CORS/DNS change, no session bridge, no live DB query, no cross-app regression test. |

### What I changed in this repo this turn

| File | Change |
|---|---|
| `docs/BACKEND_INTEGRATION_CONTRACT.md` | Now the **current v3** contract (changed sections verbatim; unchanged §B/§C/§G/§H point to the v1/v2 copies). |
| `docs/BACKEND_CONTRACT_V1.md` | Preserved v1 verbatim before overwriting the canonical file. |
| `docs/BACKEND_CONTRACT_V2.md` | Pointer corrected to the preserved v1 copy. |
| `docs/waitlist-admin-api.d.ts` | v3 types verbatim: `error?` in error envelope, nullable `waitlistNoticeVersion` / `waitlistConsentAt` / `verificationSentCount`, nullable analytics rates, 501 `error` field. |
| `src/lib/api/contract.ts` | Regenerated from v3 types. |
| `src/lib/api/client.ts` | Replaced the single `BACKEND_IMPLEMENTED` flag with three explicit gates → `BACKEND_READY = false`. Added `backendReadiness()`. **Fixed a real conformance bug**: CSV export previously reused the list serializer and would have sent `page`/`pageSize`, which v3 §F explicitly rejects — now `buildExportQuery()` omits them. Added `buildAnalyticsQuery()` (period enum, 366-day cap), `buildAuditQuery()` (`waitlist.` action prefix), `X-Requested-With` + exact `Origin` for the audited export, 501 → `WaitlistFeatureUnavailableError` mapping, and no retry on 501. |
| `src/lib/api/features.ts` | `endpointState: 'implemented-locally' \| 'unavailable-by-design' \| 'not-implemented'` replacing the now-wrong blanket `endpointAvailable: false`; `deployedVerified: false` and `callable: false` retained. |
| `src/app/[section]/page.tsx` | Honest status panel now shows endpoint state, deployment status, real-record support and the literal closed client gate. Text corrected from "API has not been implemented" to "implemented locally but not deployed". |
| `README.md` | Status, routes and doc index updated to v3. |

**`BACKEND_READY` stays `false`.** No network call is made, no BFF route handler
was added, no credentials were configured, and no live figures appear anywhere.

### Verification (this turn)

`npm run lint` 0/0 ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (10 static
pages) · query-builder conformance assertions ✅ (export omits pagination;
analytics range cap; audit action prefix; unknown-key rejection; all client
methods throw before fetch) · no secrets in any new file. No commit, push,
deploy, DNS change, migration, or auth/cookie/CORS change.

### Decisions still required from the owner

1. **Session architecture** — approve the BFF authorization-code bridge (needs
   new backend `/auth/authorize` + `/auth/exchange` endpoints, an atomic shared
   single-use store such as Redis, and a BFF encrypted session store), **or**
   the same-site `api.edupayafrica.com.ng` alias (needs DNS/CNAME, Render custom
   domain + TLS, `ADMIN_COOKIE_DOMAIN`, `ADMIN_CORS_ORIGINS` update and a
   rollout/rollback plan for existing staff apps). Both are `PROPOSAL — NOT
   IMPLEMENTED`. Do not weaken cookie/Origin/CSRF settings in the meantime.
2. **Deployment** — explicit permission to commit/push/deploy the backend
   endpoints, then a live smoke test with a real service-role query (not mocks).
3. **Schema** — permission before any campaign / consent-event / email-event /
   unsubscribe tables are created. Until then those pages stay honestly 501.
4. **Vercel scopes** — project/deployment/domain/env reads remain `Access
   denied`, so separate deployment prep cannot be verified.
5. **Optional performance decision** — `/overview` issues ~70+ sequential/bounded
   exact-count requests (30 daily + ~39 state + status/audience). If that proves
   slow on live data, the owner-approved `docs/AGGREGATE_RPC_PROPOSAL.sql`
   (PROPOSAL ONLY, NOT EXECUTED) would replace them with three read-only RPCs.

Only after 1–2 are complete should `BACKEND_READY` be flipped, BFF route
handlers added, and the pages wired to real loading/empty/error/retry/pagination
states.

## 7. Owner decisions — 2026-11-09 (current state)

A structured decision prompt returned: **BFF authorization-code bridge**,
**staging deploy first**, **schema deferred**. Full record:
[`OWNER_DECISIONS.md`](OWNER_DECISIONS.md).

| Decision | Approval | Built/deployed? |
|---|---|---|
| BFF authorization-code bridge | ✅ approach approved | ❌ `/auth/authorize` + `/auth/exchange` do not exist; atomic single-use store does not exist |
| Staging deploy + live smoke test + cross-app regression | ✅ approved | ❌ not performed (and no production deploy approved) |
| Campaign / email-event / unsubscribe / consent schema | ⛔ deferred | n/a — 501 states stay honest |

### Refined readiness gate

`src/lib/api/client.ts` no longer uses a single `BACKEND_IMPLEMENTED` flag.
Approval, implementation, deployment and live verification are separate facts:

| Gate | Value |
|---|---|
| `BACKEND_LOCAL_IMPLEMENTATION_VERIFIED` | ✅ `true` (v3, 257 mocked tests) |
| `SESSION_APPROACH_APPROVED` | ✅ `true` → `"bff-authorization-code-bridge"` |
| `SESSION_BRIDGE_IMPLEMENTED` | ❌ `false` |
| `BACKEND_DEPLOYED` | ❌ `false` (staging not deployed) |
| `LIVE_DB_VERIFIED` | ❌ `false` (mocked Supabase queries) |
| **`BACKEND_READY`** | ❌ **`false`** — every method still throws before fetch |

The section pages now display the owner decisions and the literal closed gate.

### Artefacts added

- `docs/OWNER_DECISIONS.md` — decisions, what they authorise and what they do not.
- `docs/BFF_SESSION_DESIGN.md` — concrete 8-step protocol, proposed parameters,
  frontend/backend constraints, and **§7 open items requiring security sign-off**
  (durable store, staging hostnames, additive origin allowlist, session key
  rotation, revocation, rate limits, rollback). **PROPOSAL — NOT IMPLEMENTED.**
- `docs/BACKEND_NEXT_STEPS_PROMPT.md` — pasteable prompt: Step 1 verification
  report, Step 2 bridge endpoints with exact guards/PKI/atomic consume, Step 3
  tests, Step 4 staging deploy only, Step 5 real smoke test + cross-app
  regression, Step 6 return an updated contract.
- `src/lib/api/features.ts` — `OWNER_DECISIONS` constant.
- `src/app/[section]/page.tsx`, `README.md` — decisions surfaced honestly.

**Key technical note recorded in the design:** production already sets
`Secure; SameSite=None` on the existing admin cookies, so the **single
top-level navigation** to the backend authorize endpoint can carry the existing
staff session without changing any cookie flag. After that redirect, all
browser traffic is first-party to `waitlist-admin.edupayafrica.com.ng`, and all
backend data calls are server-to-server with the existing bearer token. This is
why no cookie/CORS/CSRF weakening is needed.

**Nothing was deployed.** No commit, push, production deploy, DNS change,
migration, auth/cookie/CORS change, BFF route handler or credential was added in
this repository. The backend agent operates in its own repo/branch; the prompt
instructs it to do the approved staging work there.
