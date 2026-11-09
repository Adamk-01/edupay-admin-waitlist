# EduPay Waitlist Admin — backend integration contract

> **Source:** pasted by the project owner on 2026-11-09 from the agent with
> access to `Adamk-01/edupay-backend` only. Reproduced here verbatim except for
> one correction: the unclosed ` ```sql ` fence in section H was closed so the
> Markdown renders. **No content was changed.**
>
> **Read this first:** the document itself says *"Status: handoff /
> implementation gap … no Waitlist Admin API endpoint exists … none was found in
> this repository. The standalone frontend must remain in demo / not-connected
> mode until these routes are implemented and deployed."* It is a **design
> contract, not live endpoints**.

---

**Status: handoff / implementation gap.** This document records the verified backend auth boundary and proposes a typed API shape. It does **not** claim that any Waitlist Admin API endpoint exists: none was found in this repository. The standalone frontend must remain in demo / not-connected mode until these routes are implemented and deployed. The proposed routes below are a design contract, not live endpoints.

## A. Guard verification

### Existing guards and tests

- `src/admin/admin-session.guard.ts:92-162` — `AdminSessionGuard` is an injectable NestJS guard. It reads a bearer access token first (`:114-117`), or the access cookie; it can refresh from the refresh cookie (`:118-139`). It validates the access token by calling Supabase Auth `getUser` (`:122-125`), then queries `staff_roles` for the authenticated Auth UUID and `is_active = true` (`:143-148`). It rejects missing/invalid sessions (`:141`), query errors (`:150`), and inactive/missing/invalid staff profiles (`:151-153`). It adds server-verified `req.user` and `req.staffContext` (`:155-160`).
- `src/admin/waitlist-owner.guard.ts:11-34` — `WaitlistOwnerGuard` requires `WAITLIST_ADMIN_OWNER_USER_ID` to be a UUID (`:14-17`), reads only the session-populated `req.user.id` and `req.staffContext.role` (`:19-25`), and allows only a case-insensitive UUID match (`:28-32`). It does not use request-body/query/header identity, role, email or owner flags.
- `src/admin/admin-session.guard.spec.ts:23-75` — two tests cover rejecting a customer-origin write and accepting an admin-origin staff session. Historical result from the immediately preceding implementation run: **2 passed**.
- `src/admin/waitlist-owner.guard.spec.ts:39-114` — tests owner allowed, other admin denied, absent/blank/invalid owner configuration denied, missing identity denied, missing/inactive/invalid staff rejected by `AdminSessionGuard`, invalid Auth session denied, and body-supplied owner data ignored. Last focused test run: **10 passed**.

### Guard order and endpoints

- No Waitlist Admin controller, service, or owner-protected endpoint exists in the repository. Therefore there are currently **zero** Waitlist endpoints on which to verify guard order; no endpoint-level guard order was changed.
- Existing Mission Control and conventional admin endpoints use `AdminSessionGuard` (and sometimes `AuthRateLimitGuard`) but are not Waitlist Admin endpoints. Do not add `WaitlistOwnerGuard` to them.
- Future protected Waitlist controller must use `@UseGuards(AdminSessionGuard, WaitlistOwnerGuard)` in precisely that order at controller level (or on every protected method). Register both guards in its module. Do not mount it on public registration routes.

## B. Session and security facts

### Verified from backend source

- **Session input:** `Authorization: Bearer …` is accepted; otherwise the cookies `edupay_admin_access_token` and `edupay_admin_refresh_token` are read by `AdminSessionGuard` (`src/admin/admin-session.guard.ts:8-9,24-37,114-139`). This backend does not create a second login/user store.
- **Cookie options:** `src/admin/admin-session.guard.ts:40-48,74-83` sets both cookies `HttpOnly`, `Path=/`, without a `Domain` attribute (host-only). In production or on Render (`NODE_ENV=production` or `RENDER=true`), code sets `Secure` and `SameSite=None`; otherwise `Secure=false` and `SameSite=Lax`. Express `maxAge` also generates an Expires attribute.
  - Access cookie max age is the supplied Supabase `expires_in` bounded to 60–3600 seconds (`:76-79`). Login supplies the Supabase `expires_in` in `src/admin/mission-control.controller.ts:432-439`.
  - Refresh cookie max age uses `ADMIN_REFRESH_MAX_AGE_SECONDS`, accepted from 300 seconds through 604800 seconds; otherwise default 43200 seconds (`:10,51-57,80-83`).
- **Refresh/invalidation:** the guard attempts `refreshSession` when access validation fails and a refresh cookie exists (`:127-139`), then replaces cookies. `POST /api/v1/admin/auth/logout` attempts a refresh followed by `signOut({scope:'local'})` and clears both cookies (`src/admin/mission-control.controller.ts:443`). Global refresh-token rotation/reuse policy is **UNVERIFIED** from this repo; auth-provider flags supplied in the handoff are not backend source.
- **CSRF:** there is no synchronizer token or double-submit token. For non-GET/HEAD/OPTIONS session-guard requests, the server requires exact `X-Requested-With: edupay-admin` and an exact allowlisted `Origin` (`src/admin/admin-session.guard.ts:102-112`). This is a custom-header + Origin check, not a cryptographic CSRF token. No `Sec-Fetch-Site` check is present in that guard. Logout performs the same `X-Requested-With` and Origin checks directly (`mission-control.controller.ts:443`).
- **Credentialed CORS:** `src/main.ts:56-74` enables credentials and allows the union of origin lists. Production requires `CORS_ORIGINS` and `ADMIN_CORS_ORIGINS` (`:56-60`). Guard-side admin writes use `ADMIN_CORS_ORIGINS` (`src/common/request-origins.ts:35-39`). Values are not recorded here.
- **Owner configuration:** `src/admin/waitlist-owner.guard.ts:14` reads `WAITLIST_ADMIN_OWNER_USER_ID` (key name only). Identity is the UUID returned by validated Supabase Auth, matched to active `staff_roles` by `AdminSessionGuard`, not client input.
- **Role:** previous read-only verification in this conversation found the designated account already has an active `admin` staff profile. It was not promoted, and this work makes no role changes.
- **Body-supplied identity:** the new owner guard does not trust body identity. Existing unrelated admin endpoints may legitimately accept target identifiers for staff/customer resources; they are not authorization principals. No Waitlist endpoint currently exists.

### Cross-origin decision

**Can the existing session cookie work across the three listed origins without `SameSite=None`? No.** They are cross-site relative to one another, and the current cookies are host-only. A Lax/Strict cookie will not be sent on cross-site `fetch` requests; a Domain attribute cannot span `onrender.com`, `vercel.app`, and `edupayafrica.com.ng`.

**Implemented option: neither.** This repository currently sets SameSite=None for production/Render. Changing shared admin cookie behavior or `ADMIN_CORS_ORIGINS` would affect existing EduPay admin applications, contrary to the isolation constraint, and cannot make a cookie cross unrelated registrable domains. No change was made.

Recommended direction is a first-party server-side BFF/session bridge on the standalone app's own origin, using a narrowly scoped, single-use authorization exchange tied to the existing Supabase Auth session. The browser should receive only its own HttpOnly; Secure; SameSite=Lax cookie; no access/refresh token should be returned to browser JavaScript. **No bridge route is implemented.** Its exact protocol (authorization code, nonce/state, one-time storage, replay protection and revocation semantics) needs design and security review before implementation; do not improvise an endpoint from this document.

The same-site API alias alternative would be `api.edupayafrica.com.ng` (host alias/reverse proxy to Render) and would require owner approval for DNS/proxy, backend custom-domain deployment, cookie `Domain=.edupayafrica.com.ng`, `SameSite=Lax`/`Strict`, and `ADMIN_CORS_ORIGINS` allowlisting. These are **not implemented** and a cookie domain change affects the existing dashboard too. Vercel app `edupay-admin-livid.vercel.app` still would not become same-site with that API. Frontend cookie/BFF behavior is **UNVERIFIED**.

## C. Owner configuration

- Required backend-only key: `WAITLIST_ADMIN_OWNER_USER_ID` (UUID value deliberately omitted).
- `AdminSessionGuard` resolves the Auth user from bearer/cookie session validation, then confirms an active staff role row. `WaitlistOwnerGuard` compares that UUID with the configured UUID. Owner remains the existing `admin`; no `super_admin` promotion occurred.
- No code path in the Waitlist Admin currently trusts a request-supplied user ID, role, email, or owner flag because there are no Waitlist Admin routes. The owner guard itself ignores those inputs.

## D. Endpoint manifest and proposed contract

### Implemented endpoint manifest

**None.** No waitlist routes exist in this checkout. In particular, there is no overview, registrations list/detail, analytics, CSV export, settings, audit, campaign, email activity, test-email, or consent-history endpoint. There is no backend route contract that the frontend can call today.

### Proposed future route shape (NOT IMPLEMENTED)

Suggested base path: `/api/v1/admin/waitlist`. Every route below is planned, not live. All must run `AdminSessionGuard` then `WaitlistOwnerGuard`. Read endpoints should use the global error envelope described below; protected writes/exports must use CSRF header and exact allowed Origin checks. Pagination should cap at 100 rows/page; CSV should cap at 5,000 rows. No body/query value may override the authenticated owner.

| Method | Proposed path | Auth / guards | Inputs and validation | Pagination | Proposed success response | Errors | Audit / limit |
|---|---|---|---|---|---|---|---|
| GET | `/overview` | Staff session; `AdminSessionGuard → WaitlistOwnerGuard` | No parameters | n/a | `OverviewResponse` | 401, 403, 500/503 | No audit; backend rate-limit policy TBD |
| GET | `/registrations` | Same | `q` optional string 1–100 chars; `audience` enum; `status` enum; `state` 1–120 chars; `from`/`to` ISO dates; `page` integer >=1 default 1; `pageSize` integer 1–100 default 25; reject unknown query keys and `from > to` | 100 | `RegistrationListResponse` | 400, 401, 403, 500/503 | No audit; rate limit TBD |
| GET | `/registrations/:id` | Same | UUID `id` | n/a | `RegistrationDetailResponse` | 400, 401, 403, 404, 500/503 | No audit; rate limit TBD |
| GET | `/analytics` | Same | `period` enum `day\|week\|month`, bounded date range | n/a | `AnalyticsResponse` | 400, 401, 403, 500/503 | No audit; rate limit TBD |
| GET | `/registrations/export.csv` | Same | Same filters as list; strict allowlist; max 5,000 rows | 5,000 | CSV attachment | 400, 401, 403, 429, 500/503 | `waitlist.exported`; rate limit TBD |
| GET | `/settings` | Same | No parameters | n/a | `SettingsResponse`; key names/status only | 401, 403, 500/503 | No audit; rate limit TBD |
| GET | `/audit-logs` | Same | `page` >=1 default 1; `pageSize` 1–100 default 25; optional bounded date/action filter | 100 | `AuditListResponse` | 400, 401, 403, 500/503 | No audit; rate limit TBD |
| GET | `/email-activity` | Same | Optional signup UUID; no token fields | n/a | 501 with `FEATURE_UNAVAILABLE` until event source exists | 401, 403, 501 | No audit; rate limit TBD |
| GET | `/campaigns` | Same | n/a | n/a | 501 with `FEATURE_UNAVAILABLE` until schema/service exists | 401, 403, 501 | No audit; rate limit TBD |

These paths, validations and limits are a proposal, not verified existing behavior. The error envelope shape is based on `src/common/api-exception.filter.ts`; availability of each proposed route is not implied.

### Type declarations

The complete copyable proposed request/response declarations are in `docs/waitlist-admin-api.d.ts`. That file describes the proposal above only. It does not prove endpoints exist.

## E. Data support matrix

The following schema facts are supplied as verified external input in the handoff; the waitlist migration is absent from this checkout, so they are not independently confirmed from repository migrations. No live database access was performed for this handoff.

| Feature | Data support | Current backend implementation |
|---|---|---|
| Overview counts / audience counts / verified counts | **SUPPORTED BY SUPPLIED SCHEMA** (`waitlist_signups.status`, `audience_type`) | **UNAVAILABLE**: no endpoint/service |
| Growth / day-week-month trends / top states / verification and marketing rates | **SUPPORTED IN PRINCIPLE** by `created_at`, `state`, `status`, `marketing_consent`; requires grouped aggregate queries | **UNAVAILABLE**: no endpoint/service; avoid pulling the full table as a pseudo-aggregate |
| Registration search/list/detail | **SUPPORTED BY SUPPLIED SCHEMA** (`full_name`, `email`, filters and consent columns) | **UNAVAILABLE**: no endpoint/service |
| Email delivery summary | **UNAVAILABLE**: schema has only verification send count and last-send timestamp; no event/delivery log. `verification_sent_count` is not evidence of delivery. | Not implemented |
| Delivery/bounce/failed/open/click statistics | **UNAVAILABLE**: no provider event table/webhook ingestion | Not implemented; add provider webhook ingestion and durable events first |
| Unsubscribe activity | **UNAVAILABLE**: no unsubscribe status/ledger | Not implemented; add unsubscribe state and suppression enforcement first |
| Resend activity | **PARTIALLY SUPPORTED**: current send count and last-send timestamp only; no per-attempt history | No admin endpoint; do not call this a complete activity log |
| Consent history | **UNAVAILABLE**: current consent booleans, notice version and timestamps only; no historical event table | Not implemented; DDL proposal below |
| Campaign create/edit/preview/test/schedule/send/statistics | **UNAVAILABLE**: no campaign, recipient, template, queue, idempotency, send or event schema/service | Not implemented; DDL/service/webhook proposal below |
| Verification token data | Never needed by admin list/analytics/export. `token_hash` and raw tokens must never be returned. | No endpoint |

## F. CSV contract (proposed, not implemented)

- Proposed columns in this exact order: `id,full_name,email,phone,audience_type,state,school_name,education_level,institution_name,institution_type,contact_role,waitlist_consent,waitlist_notice_version,waitlist_consent_at,marketing_consent,marketing_consent_at,status,verified_at,created_at`.
- Header row uses those exact snake_case names. Exclude `email_key`, token tables/fields, service-only data, and any owner UUID.
- Apply the same validated filters as registration listing before export. Default: all matching rows; verified-only and audience selections are ordinary filters. Removed signups may be included only when explicitly filtered/selected by authorized owner.
- Hard cap: **5,000 rows**; exceedance should return 400 `EXPORT_LIMIT_EXCEEDED` rather than silently truncate.
- RFC 4180-style quoting: quote every cell; double embedded `"`; CRLF records; UTF-8; protect spreadsheet formula injection by prefixing an apostrophe to values beginning (after leading whitespace) with `=`, `+`, `-`, or `@`.
- `Content-Type: text/csv; charset=utf-8`; suggested filename `edupay-waitlist-YYYYMMDD-HHmmss.csv` (UTC). Audit successful export as `waitlist.exported` with filter names/row count, never exported values or PII.

## G. Environment

No frontend-public API URL variable or Waitlist Admin BFF configuration exists in this repo. Server-side keys from source:

| Key | Scope | Purpose / safe placeholder |
|---|---|---|
| `WAITLIST_ADMIN_OWNER_USER_ID` | SERVER-ONLY | Designated Supabase Auth owner UUID; `<owner-auth-uuid>` |
| `SUPABASE_URL` | SERVER-ONLY | Existing Supabase project URL; `<supabase-project-url>` |
| `SUPABASE_SERVICE_ROLE_KEY` | SERVER-ONLY | Existing backend DB client credential; never expose to frontend |
| `SUPABASE_ANON_KEY` | SERVER-ONLY in this backend process | Existing auth client configuration; never paste into this contract |
| `ADMIN_CORS_ORIGINS` | SERVER-ONLY | Existing admin origin allowlist |
| `CORS_ORIGINS` | SERVER-ONLY | Existing customer origin allowlist |
| `ADMIN_REFRESH_MAX_AGE_SECONDS` | SERVER-ONLY | Existing refresh-cookie lifetime override |
| `RESEND_API_KEY` | SERVER-ONLY, external waitlist function only | Supplied external config key; not used by this backend |
| `WAITLIST_FROM_EMAIL`, `WAITLIST_NOTIFY_EMAIL`, `WAITLIST_NOTICE_VERSION`, `WAITLIST_SITE_URL`, `WAITLIST_ALLOWED_ORIGINS` | SERVER-ONLY, external waitlist function | Supplied external config keys; not read by this backend |

The API base URL is **not configured in this backend for a Waitlist Admin client**. Deployment host is not verified in this checkout. For the proposed same-origin BFF pattern, the frontend server should hold the backend API origin in its own server-only config and make browser requests to relative BFF routes. Browser calls must not contain service-role credentials or session tokens in JavaScript. Direct browser-to-backend cookie access is not approved for these distinct origins.

## H. Migrations (proposals only; NOT EXECUTED)

No new migration is present or executed. Campaigns and consent history require durable storage before honest implementation. Example starting DDL only (review/adjust to actual project conventions and privacy retention before requesting permission):

```sql
-- PROPOSAL ONLY — NOT EXECUTED. Requires explicit owner approval and migration review.
CREATE TABLE IF NOT EXISTS public.waitlist_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signup_id uuid NOT NULL REFERENCES public.waitlist_signups(id) ON DELETE CASCADE,
  consent_kind text NOT NULL CHECK (consent_kind IN ('waitlist', 'marketing')),
  consent_value boolean NOT NULL,
  notice_version text,
  source text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.waitlist_consent_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_consent_events FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.waitlist_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'scheduled', 'sending', 'complete', 'cancelled')),
  scheduled_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.waitlist_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_campaigns FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.waitlist_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.waitlist_campaigns(id) ON DELETE CASCADE,
  signup_id uuid NOT NULL REFERENCES public.waitlist_signups(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'suppressed')),
  idempotency_key text NOT NULL UNIQUE,
  provider_message_id text,
  attempted_at timestamptz,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, signup_id)
);
ALTER TABLE public.waitlist_campaign_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_campaign_recipients FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.waitlist_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES public.waitlist_campaign_recipients(id) ON DELETE SET NULL,
  provider_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.waitlist_email_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_email_events FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.waitlist_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signup_id uuid NOT NULL UNIQUE REFERENCES public.waitlist_signups(id) ON DELETE CASCADE,
  reason text,
  source text NOT NULL,
  unsubscribed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.waitlist_unsubscribes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_unsubscribes FROM PUBLIC, anon, authenticated;
```

This proposal is incomplete for production use until retention, event authenticity/signatures, indexes, worker locking, permission grants restricted to trusted server roles, unsubscribe token design, and transactional campaign eligibility are reviewed. Applying any DDL requires explicit owner permission.

## I. Files and test/build status

Files created in this work:

- `docs/BACKEND_INTEGRATION_CONTRACT.md` — this handoff.
- `docs/waitlist-admin-api.d.ts` — proposed API types only.

Pre-existing untracked owner guard files from the immediately preceding task:

- `src/admin/waitlist-owner.guard.ts`
- `src/admin/waitlist-owner.guard.spec.ts`

No controller, route, migration, database record, role, cookie, CORS, or deployment configuration was changed in this handoff. No commits, pushes or deployments were performed.

Validation in this turn (after npm ci): `npm test -- --runInBand` PASS — 23 suites, 243 tests; `npm run lint` PASS; `npm run build` PASS; `npx tsc --noEmit --incremental false` PASS. Jest emitted expected mocked/disabled-service warnings and a deliberate console.error in a wallet error-path test; the suite still passed. npm ci reported 21 dependency audit findings (8 low, 13 moderate); no dependency files were changed.

## J. Open questions / UNVERIFIED

- UNVERIFIED: current production deployment host, DNS/proxy arrangement, Vercel frontend server configuration, and browser cookie behavior.
- UNVERIFIED: current production value of the owner UUID environment setting; it is intentionally not requested or printed.
- UNVERIFIED: live database values, counts and waitlist data in this handoff; no live DB queried.
- UNVERIFIED: whether a production Waitlist Admin app origin is already listed in deployment environment configuration.
- UNVERIFIED: Supabase auth token rotation/reuse settings and exact session behavior outside what backend source calls.
- UNVERIFIED: cross-app regressions for customer app, existing admin dashboard and Mission Control; cannot be tested from this repository.
- UNVERIFIED: frontend cookie handling and whether its deployment can host a secure server-side BFF.
- Need owner approval for a cross-origin solution and a separately reviewed session-bridge protocol. Until then, do not weaken SameSite, cookie scope, or Origin/CSRF checks.
- Need permission before creating/applying schema migrations or enabling campaign sending. No campaign or consent-history endpoint should claim the absent data exists.
