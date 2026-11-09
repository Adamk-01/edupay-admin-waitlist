# Phase 1 — Architecture & Security Audit

**Date:** 2026-11-09
**Repository under development:** `Adamk-01/edupay-admin-waitlist` (this checkout, branch `arena/afa8c9f6-edupay-admin-waitlist`)
**Requested by:** production implementation brief for the EduPay Waitlist Admin / Launch Control dashboard
**Status:** **Phase 1 complete; Phase 2–5 implementation deliberately paused.**

> **Stop condition triggered.** Two of the brief's own rules apply:
> *"If the existing authentication cannot securely support this architecture, explain the limitation and propose the smallest safe solution before implementation"*, and
> *"If an important architectural decision is uncertain, stop and explain the issue rather than guessing."*
> Both are true here. No backend endpoint, page, migration, deployment, DNS change, commit or push was performed.

---

## 0. Executive summary

| # | Finding | Status |
|---|---|---|
| 1 | The correct backend repository is `Adamk-01/edupay-backend` (**private**) | Identified, **not readable** |
| 2 | Its `AdminSessionGuard`, `WaitlistOwnerGuard`, tests, guard order, cookie/CORS/CSRF config | **Cannot verify — access denied** |
| 3 | Existing waitlist tables, migration, registration + verification endpoints, token expiry, email infra | **Verified** (public waitlist source + live Supabase) |
| 4 | Staff identity/role model (`staff_roles`), audit log, notification infra | **Verified** (live DB schema, read-only) |
| 5 | Campaign, email-delivery, bounce and unsubscribe data | **Does not exist** in the live database |
| 6 | Cross-origin staff session across `*.vercel.app` → `waitlist-admin.edupayafrica.com.ng` → Render backend | **Not securely possible as-is**; smallest safe solution in §6 |
| 7 | Critical Next.js RCE advisory in this frontend | **Patched** (15.5.27 → 15.5.29); see §9 |

**Bottom line:** the requested feature set cannot be built honestly yet. Roughly half of it (Overview, Registrations, Analytics, Exports, Settings) is derivable from real `waitlist_*` records; the other half (Launch Campaigns, Email Activity, consent *history*, delivery/bounce statistics) has **no backing data or infrastructure** and would require new schema and new backend services — i.e. a migration, which needs your explicit permission. All of it must be gated by an owner-only backend guard whose implementation I cannot inspect.

---

## 1. Repository discovery (what "the EduPay connected source project" resolves to)

The GitHub App installation visible to this session lists **7** repositories:

| Repository | Visibility | Role | Content access |
|---|---|---|---|
| `Adamk-01/edupay-backend` | private | **the existing EduPay backend** | ❌ denied |
| `Adamk-01/edupay-admin` | private | existing EduPay admin dashboard | ❌ denied |
| `Adamk-01/edupay-customer` | private | customer application | ❌ denied |
| `Adamk-01/edupay-waitlist` | public | waitlist marketing site + waitlist schema | ✅ readable |
| `Adamk-01/edupay-admin-waitlist` | public | **this app** | ✅ readable |
| `Adamk-01/Edupay` | public | older FastAPI/Alembic monorepo (2026-09) | ✅ readable |
| `Adamk-01/FOCIT-LMS`, `alphaphysics-website`, `ZOVA-ARCHITECTURE` | public | unrelated | — |

**Access failure evidence (no credentials printed):**

```
GET /repos/Adamk-01/edupay-backend            -> 403 "Resource not accessible by integration"
GET /repos/Adamk-01/edupay-backend/contents   -> 403 "Resource not accessible by integration"
GET /repos/Adamk-01/edupay-backend/git/trees  -> 403 "Resource not accessible by integration"
git ls-remote .../edupay-backend.git          -> 403
codeload tarball (unauthenticated)            -> 404
```

`GET /user/installations/.../repositories` returns the repo **names only**. Global GitHub code search finds no `WaitlistOwnerGuard` in any indexed repository. Branches checked: `main`/`develop` of `Adamk-01/Edupay` (Python FastAPI, no guards), and all four `arena/*` branches plus `main` of `edupay-waitlist` (no guard/session files).

`Adamk-01/Edupay` is **not** the current backend: it is a FastAPI + Alembic app with `bill_order`, `exam_order`, `wallet`, `google_auth` routers; no waitlist tables, no staff guards, and it predates the live Supabase/Render architecture. Treating it as the backend would violate *"do not make assumptions about database schemas, endpoints, authentication"*.

**Vercel connector:** `validate_credential` succeeds and `get_authenticated_user` works, but `list_projects`, `list_deployments`, `list_domains`, `list_user_events` and `get_deployment` all return **"Access denied … token may not have the required permissions"**. Therefore deployed project settings, environment variables, domains and the live deployment for `edupay-admin-livid.vercel.app` could **not** be inspected either.

---

## 2. Waitlist database tables and migrations — VERIFIED

Source of truth: `supabase/migrations/20261106090000_create_waitlist_schema.sql` in the public `edupay-waitlist` repo. Live database confirms migration `20261106090534 create_waitlist_schema` among **17 applied migrations**. The other 16 belong to the customer/admin product (orders, wallets, services, staff, push, security hardening).

Three existing tables — **reuse these; do not create duplicates**:

| Table | Key columns | Notes |
|---|---|---|
| `public.waitlist_signups` | `id`, `full_name`, `email`, `email_key`, `phone`, `audience_type`, `state`, `school_name`, `education_level`, `institution_name`, `institution_type`, `contact_role`, `waitlist_consent`, `waitlist_notice_version`, `waitlist_consent_at`, `marketing_consent`, `marketing_consent_at`, `status`, `verified_at`, `verification_sent_count`, `last_verification_sent_at`, `created_at`, `updated_at` | Unique index on `email_key`; index on `(status, created_at desc)`. Constraints: `waitlist_consent = true`, `marketing_consent ↔ marketing_consent_at`, `status='verified' ↔ verified_at`, `audience_type ∈ {student, parent_guardian, institution}`, `status ∈ {pending_verification, verified, removed}`. |
| `public.waitlist_verification_tokens` | `id`, `signup_id`, `token_hash`, `expires_at`, `consumed_at`, `created_at` | Only SHA-256 hashes (64 chars) stored; raw tokens never persisted. |
| `public.waitlist_request_log` | `id`, `bucket_key`, `route`, `created_at` | Rate-limit counter. |

**Posture (live, verified):** RLS enabled on **all 30 `public` tables**; `0` RLS-disabled tables; **zero RLS policies**; `anon` has no `SELECT` or write grants on any table; `authenticated` has no `SELECT` grants. Deny-by-default — waitlist data is reachable only with the service role from trusted server code. **This must be preserved**: no new policies that expose signups to `anon`/`authenticated`.

Live row counts at audit time (aggregates only, no personal data): `waitlist_signups = 2`, `waitlist_verification_tokens = 2`, `waitlist_request_log = 15`, `staff_roles = 2`, `audit_logs = 87`, `profiles = 13`. The demo UI's `2,450` registrations is therefore **fabricated**, as the brief forbids for production views.

### What is NOT in the database

- ❌ No campaign, campaign-recipient, email-template or scheduled-send tables.
- ❌ No email-delivery / bounce / failure / open / click records anywhere.
- ❌ No unsubscribe ledger. "Unsubscribed" can only be derived as `marketing_consent = false` on `waitlist_signups`; there is no unsubscribe *event* history.
- ❌ No consent *history* table. Only the current consent state, notice version and two timestamps are stored. A "consent history" view cannot be produced from existing records.
- ❌ No referral fields (none required; brief forbids referrals).
- ❌ No owner-config column in any table. `admin_operational_settings` exists with `setting_key`, `setting_value jsonb`, `updated_by`, `updated_at`, and contains only `operational_preferences`. The configured owner UUID is therefore **not** stored in the database — most likely a backend environment variable, but that is **unverified**.

---

## 3. Registration / verification endpoints and token expiry — VERIFIED

A single Supabase Edge Function, **`waitlist`**, slug `waitlist`, status `ACTIVE`, deployed **version 10**, **`verify_jwt: false`** (deliberately public, stateless).

```
POST <SUPABASE_FUNCTIONS_URL>/waitlist   { action: "register", ...fields }
POST <SUPABASE_FUNCTIONS_URL>/waitlist   { action: "verify",   token }
POST <SUPABASE_FUNCTIONS_URL>/waitlist   { action: "resend",   email }
```

- Public base URL used by the marketing site: `NEXT_PUBLIC_EDUPAY_API_URL` → `<project>.supabase.co/functions/v1`.
- **Token expiry:** `TOKEN_TTL_MINUTES = 60*24` = **24 hours**, stored in `expires_at`. Tokens are single-use (`PATCH ... &consumed_at=is.null` with `Prefer: return=representation`, so a zero-row result means already consumed), old unconsumed tokens are deleted on re-issue, and only `sha256(token)` is stored. Expired tokens return `{state:"expired"}`; unknown/consumed return `{state:"invalid"}`.
- **Validation:** name/email/phone/audience/conditional student & institution fields, required `waitlistConsent`, enum allowlists, `8 KiB` body cap, generic responses (no account enumeration), HTML escaping in outbound email.
- **Rate limits:** register 5/IP/hour + 3/email/hour, resend 20/IP/hour + 3/email/hour, resend cooldown 10 min; `main` source also rate-limits `verify` at 60/IP/hour.
- **Known weaknesses in this public function (from source, not exploitable assumptions):**
  - CORS allowlist (`WAITLIST_ALLOWED_ORIGINS`) is only **reflected** in `Access-Control-Allow-Origin`; a disallowed origin falls back to the first exact allowlist entry, and the handler **never returns 403 before side effects**. Non-browser clients and cross-site simple requests can still trigger email sends.
  - `clientIp()` trusts the first `x-forwarded-for` value.
  - `withinLimit()` explicitly **fails open** on a failed count read and is **non-atomic** (HEAD count → POST insert).
  - `waitlist_request_log` has no visible retention/cleanup.
  - **Deployed v10 differs from `main` source**: v10 uses exact-origin matching and lacks the `verify` rate limit; `main` adds single-label wildcard patterns and `verify` limiting. Which revision is live must be confirmed before relying on either behaviour.
- **No `Access-Control-Allow-Credentials`, no cookies, no CSRF tokens** on these public endpoints. They are stateless and hold no staff session.

---

## 4. Staff auth, guards, owner-only enforcement — BLOCKED

| Brief item | Result |
|---|---|
| `AdminSessionGuard` implementation | ❌ Not verifiable — backend source unreadable |
| `WaitlistOwnerGuard` implementation **and its tests** | ❌ Not verifiable — backend source unreadable; no guard exists in any accessible repo |
| Guard order `AdminSessionGuard → WaitlistOwnerGuard` on protected endpoints | ❌ Not verifiable |
| Existing staff authentication mechanism | ❌ Not verifiable; only the *data model* below is known |
| Owner UUID configured & checked server-side | ❌ Not verifiable; no owner column in DB |
| Cookie domain / `SameSite` / `Secure` / `HttpOnly` | ❌ Not verifiable |
| Credentialed CORS, CSRF, session configuration | ❌ Not verifiable |

### What IS verifiable about staff identity (live DB, schema only)

- `public.staff_roles(user_id uuid, role text, is_active boolean, created_at, updated_at)` with check constraint
  `role ∈ {admin, super_admin, operator, operations, finance, finance_approver, analyst, support}`.
  Live distribution: **1 `admin`, 1 `operator`** — no `super_admin` row. This is consistent with the brief's rule that the designated owner stays an existing `admin` and is **not** promoted.
- 34 `SECURITY DEFINER` functions in `public` (admin wallet/order/staff operations), most with an empty `search_path`; **none** of the 35 public functions is executable by `anon` or `authenticated`. Role resolution therefore happens in trusted server code, not via PostgREST from a browser.
- `public.audit_logs(id, actor_user_id, actor_type, action, resource_type, resource_id, metadata jsonb, created_at)` with `actor_type ∈ {customer, staff, system}`. Existing action naming is `domain.action`, e.g. `wallets.exported`, `pii.revealed`, `staff.invited`. **This table is directly reusable** for recording exports, campaign sends and owner-only settings changes (`waitlist.exported`, etc.). A `prevent_audit_log_mutation` trigger exists.
- Supabase Auth config (flags only, no values): `jwt_exp = 3600`, refresh-token rotation enabled, unverified email sign-ins disallowed, TOTP MFA available, external Google provider enabled; `site_url` points at the production apex; redirect allowlist includes `localhost:3000`, `127.0.0.1:3000` and a Render OAuth callback. Also: signup enabled, breached-password check off, captcha off, session inactivity timeout `0`, current-password-on-change off. These are **customer** auth settings, not proof of how the staff admin session works.

**Consequence:** every acceptance test in the brief that depends on guards — "another admin cannot access owner-only pages", "unauthenticated users cannot access protected endpoints", "direct API requests cannot bypass authorization", "invalid sessions fail safely" — is **untestable** until backend source is available. I will not write a second guard or a second auth system to work around this.

---

## 5. Email, campaign and notification infrastructure — VERIFIED

- **Email delivery:** the `waitlist` Edge Function calls the Resend REST API directly (`RESEND_API_KEY`), using `WAITLIST_FROM_EMAIL` and `WAITLIST_NOTIFY_EMAIL`. It sends (a) verification emails and (b) a team notification containing the signup's details. Supabase Auth is configured with Resend SMTP and references a `send-email` hook function; the deployed function list contains only `waitlist`, so that hook's status needs verification.
- **No persistence of email outcomes:** no table records sent/delivered/bounced/failed events, so the requested *Email delivery summary*, *Delivery status*, *Bounce information*, *Failed deliveries*, *Resend activity* and campaign statistics **cannot be produced from actual database records**. Per the brief's rule ("Only display analytics that can be supported by actual database records"), these must show an honest unavailable state until a delivery log + provider webhook ingestion exists.
- **Notification infra that exists but is not reusable for the waitlist:** `notifications(user_id, kind, title, body, href, read_at)` plus `push_subscriptions`, `push_notification_preferences`, `push_notification_dispatches` (FCM migration `20261102154031`). These are keyed to **customer `auth.users`**; waitlist signups have their own `id` and are deliberately *not* accounts (the migration says "no accounts, no wallets, no payments"). Wiring waitlist signups into them would break the "separate application" rule.
- **No campaign functionality of any kind** exists in accessible sources or the live DB: no tables, no RPCs, no Edge Functions, no templates, no scheduling, no test-send, no unsubscribe endpoint.

---

## 6. Cross-subdomain session analysis — ARCHITECTURAL BLOCKER

Origins in scope:

| Origin | Registrable domain (eTLD+1) |
|---|---|
| `edupay-admin-livid.vercel.app` | `vercel.app` (shared Vercel preview namespace) |
| `waitlist-admin.edupayafrica.com.ng` | `edupayafrica.com.ng` |
| production backend (`edupay-backend-…onrender.com`) | `onrender.com` |

**There is no common registrable domain.** A `Set-Cookie` `Domain` attribute can only name a domain that is a suffix of the responding host, and cannot be a public suffix. Therefore:

1. A session cookie issued by the existing admin on `*.vercel.app` **can never** be sent to `waitlist-admin.edupayafrica.com.ng`.
2. The Render backend cannot set a cookie for `.edupayafrica.com.ng` — browsers reject it.
3. Even if `Domain=.vercel.app` were accepted, it would share the session cookie with **every other Vercel project**, which is unacceptable. (`vercel.app` and `onrender.com` are public-suffix-listed; confirm against the current PSL before relying on this.)

The only way to keep the current three-origin layout is cross-site XHR with `credentials: 'include'`, a `SameSite=None; Secure` cookie on the backend's own domain, `Access-Control-Allow-Credentials: true` with an exact origin allowlist, and a full CSRF defence (token + `Origin`/`Sec-Fetch-Site` checks). That **weakens `SameSite`**, depends on third-party cookies (blocked by Safari ITP and being phased out in Chrome), and directly conflicts with *"Do not weaken authentication or cookie security to make cross-subdomain login work."* **Not recommended.**

### Smallest safe solution (proposal — needs your decision, not yet implemented)

**Option A (preferred, no new auth system, no weakening):** make the admin and the session-issuing backend **same-site**.

- Serve this app at `waitlist-admin.edupayafrica.com.ng`.
- Expose the existing backend's staff-auth + waitlist-admin API on a subdomain of the same registrable domain, e.g. `api.edupayafrica.com.ng` (DNS alias to the Render service, or a reverse proxy).
- Keep the existing session cookie as `HttpOnly; Secure; SameSite=Lax (or Strict); Domain=.edupayafrica.com.ng`. Both subdomains are same-site, so the cookie flows normally; no third-party cookies, no `SameSite=None`, no credentialed cross-site CORS, no second identity provider.
- Reuse `AdminSessionGuard → WaitlistOwnerGuard` unchanged on every endpoint. Owner check stays server-side against the configured owner UUID.
- Requires a DNS/host alias **later** — nothing is changed now, per your instruction.

**Option B (if the backend cannot be given a same-site alias):** a thin **BFF** in this Next.js app. Server-side route handlers proxy the existing staff login and all API calls; the browser holds only a first-party `HttpOnly; Secure; SameSite=Lax` cookie on `waitlist-admin.edupayafrica.com.ng` containing an opaque session handle. No tokens or secrets reach the browser. This is a *session bridge*, not a second authentication system, but it adds a session layer and **cannot be designed safely until the backend's session representation (cookie vs. bearer, TTL, rotation) is read from source**.

**Option C (reject):** `SameSite=None` + credentialed cross-site CORS.

All three options require reading `edupay-backend` first. I have not chosen one on your behalf.

---

## 7. Endpoint gap analysis (design must follow the real backend)

In **accessible** sources the only waitlist API is the public `waitlist` Edge Function. No owner-protected waitlist admin endpoints exist in any readable repository; the private backend may already contain some — **unverified**. Final route names must follow the backend's actual architecture, never the names below.

| Requested capability | Backing data today | Gap |
|---|---|---|
| Overview: totals, verified/unverified, audience split, growth, top states, recent registrations | `waitlist_signups` | **Read-only aggregate endpoints needed**, owner-only |
| Overview: **email delivery summary** | none | Unavailable until a delivery log exists |
| Registrations: search / audience / status / state / date filters, pagination, detail | `waitlist_signups` | List + detail endpoints needed; never return `token_hash` |
| Registrations: **consent history** | current state only | Needs a new history table (migration → your permission) or display "current consent only" |
| Registrations: **email activity** | none | Unavailable until a delivery log exists |
| Analytics: trends day/week/month, audience, verification rate, marketing subscription rate, states | `waitlist_signups` | All derivable from real records ✅ |
| Launch Campaigns: create/edit/preview/audience/test/schedule/send/stats | none | **Entire subsystem missing** (schema + RPCs + mail provider + unsubscribe handling + audit) |
| Email Activity: verification/campaign/delivery/bounce/failed/unsubscribe/resend | none | **Entire subsystem missing** |
| Exports: all / verified / audience / filtered CSV | `waitlist_signups` | Owner-only export endpoint + `audit_logs` entry (precedent `wallets.exported`); enforce pagination/row caps; no token hashes |
| Settings: owner info, sender status, waitlist config, audit log, system status | `staff_roles`, `audit_logs`, secret *names*, project health | Read-only status endpoint; **never return secret values, owner UUID into the browser, or tokens** |

Every protected endpoint must: authenticate the existing staff session → apply `AdminSessionGuard` → `WaitlistOwnerGuard` → validate inputs → cap pagination → validate filters → avoid unnecessary PII → audit sensitive actions (export, campaign send, settings change). The backend must resolve the staff identity from the session, **never** from a request body.

---

## 8. Decisions required before I continue

1. **Grant read access** to `Adamk-01/edupay-backend` (and, for cookie/session config, `Adamk-01/edupay-admin`) for this Arena session's GitHub token — or reconnect GitHub with a token that has `contents: read` on those private repos. I need to inspect `AdminSessionGuard`, `WaitlistOwnerGuard` + tests, guard ordering, session cookie flags, CORS/CSRF config and the owner-UUID config key. I will not recreate a guard or guess its contract.
2. **Choose the session architecture**: Option A (same-site subdomain for the backend, recommended), Option B (BFF session bridge), or reject both with another approach. This determines the deployment and API design.
3. **Approve (or reject) new schema** for campaigns / email-delivery / unsubscribe / consent-history. This implies a database migration, which I will not run without explicit permission.
4. **Confirm the owner account** remains the existing `admin` and tell me the **name** of the backend config key holding the owner UUID (no value needed). Confirm no promotion to `super_admin`.
5. **Confirm Vercel access** (token scopes) so deployments, env vars and domains can be checked before any deployment preparation is finalised. No deploy or DNS change will be made regardless.

---

## 9. Stage 0 groundwork actually performed (verifiable, architecture-independent)

These changes do **not** depend on the backend contract, do not touch the customer or existing admin apps, and do not alter the dashboard's visual identity. Backups of every edited file are in `/home/user/pre-stage0-backups/` (outside this repository).

| File | Change |
|---|---|
| `package.json`, `package-lock.json` | `next` + `eslint-config-next` `15.5.27 → 15.5.29` (**fixes the critical RCE / Server-Action DoS advisories**); declared `@eslint/eslintrc` explicitly instead of relying on a transitive install |
| `.env.example` | Rewritten with real newlines (the old file contained literal `\n` sequences on one line), **variable names + safe placeholders only**, and an explicit "no secrets here" rule |
| `next.config.ts` | Removed UTF-8 BOM; added CSP, HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, COOP/CORP, Permissions-Policy; `poweredByHeader: false`, `reactStrictMode: true`; `connect-src 'self'` |
| `src/app/layout.tsx` | `robots: noindex, nofollow, nocache`; optional `metadataBase` |
| `src/lib/config.ts` *(new)* | Build-time `DATA_MODE` / `IS_DEMO` / `SITE_URL` / `BACKEND_CONNECTED = false` seam; no secrets |
| `src/app/page.tsx` | Non-dismissible "DEMO · NO BACKEND / NOT CONNECTED" label; removed the dismissible banner and the hard-coded stale date; `live` mode renders an **honest "backend not connected" panel instead of invented figures**; removed unused import |
| `eslint.config.mjs`, `postcss.config.mjs` | Named exports (lint warnings) |
| `README.md` | Local run instructions, env-var table, data modes, security posture, deployment preparation (no deploy/DNS), pointers to both audits |
| `docs/PHASE1_ARCHITECTURE_AUDIT.md` | This document |

**Verification results:** `npm install` ✅ · `npm run lint` **0 errors / 0 warnings** ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (4 static pages, `/` 6.42 kB / 109 kB First Load JS) · built HTML contains `<meta name="robots" content="noindex, nofollow, nocache">` ✅ · `npm audit`: **critical 0** (was 1), high 1, moderate 7, total 8.

**Data-mode verification (both builds executed):** with `NEXT_PUBLIC_DATA_MODE=live` the prerendered HTML contains the "Live data is not available yet" panel and the `NOT CONNECTED` label, and contains **none** of the fabricated figures (`2,450`, `1,890`) or sample person names. The default `demo` build contains the non-dismissible demo banner. The workspace was restored to the default demo build afterwards.

**Remaining advisories:** the bundled `postcss` (high) and a `next` moderate advisory are resolved only by **Next 16.4.5**, a *breaking major upgrade* that also requires `eslint-config-next@16`. The `@typescript-eslint/minimatch` chain is dev-only. I did **not** perform the major upgrade — it needs your explicit approval because the brief pins Next 15.5.27 and forbids breaking existing functionality.

**Not done:** no backend endpoints, no pages, no API client, no tests, no auth wiring, no migrations, no deployments, no DNS changes, no commits, no pushes. No passwords, secrets, private keys, owner IDs or tokens were printed, requested or exposed.

---

## 10. Phase 5 test status

| Test group | Status |
|---|---|
| TypeScript / lint / production build / dependency audit | ✅ executed (results §9) |
| Authentication & authorisation (6 cases) | ⛔ blocked — no backend source, no guards, no session, no endpoints |
| Registrations (search/filters/pagination/details/consent) | ⛔ blocked — no owner-only API |
| Campaigns (test send, unsubscribe exclusion, confirmation, failed delivery) | ⛔ blocked — no campaign subsystem or schema |
| Exports (CSV accuracy, filters, unauthorized rejection) | ⛔ blocked — no export endpoint |
| "No existing EduPay functionality broken" | ✅ nothing outside this repository was touched |

---

## 11. Exact local run instructions

```bash
cd <this repository>
npm install
cp .env.example .env.local     # optional; every value is a safe placeholder
npm run dev                    # http://localhost:3000
```

`NEXT_PUBLIC_DATA_MODE=demo` (default) shows the labelled demo. Set it to `live` to see the honest "live data is not available yet" state. No backend is contacted in either mode.

Checks: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm audit`.
