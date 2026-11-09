# EduPay Waitlist Admin — backend integration contract (CURRENT: v3)

> **This is the current contract**, pasted by the owner on 2026-11-09 from the
> agent with access to `Adamk-01/edupay-backend` only. It is **v3**: endpoints
> are implemented locally, not deployed.
>
> **Provenance:** the full v1 text is preserved in
> [`BACKEND_CONTRACT_V1.md`](BACKEND_CONTRACT_V1.md); the v2 blocker + session
> proposals are in [`BACKEND_CONTRACT_V2.md`](BACKEND_CONTRACT_V2.md).
> Unchanged sections from v1/v2 — §B "Verified from backend source", §B
> "Cross-origin decision" and both `PROPOSAL — NOT IMPLEMENTED` blocks, §C,
> §G, §H — remain as recorded there and are **not repeated here**. The unclosed
> ` ```sql ` fence in v1 §H was closed in the v1 copy so Markdown renders.
>
> **Frontend-relevant bottom line:** "implemented locally, not deployed …
> The standalone frontend must not assume a deployed API until deployment is
> separately approved." The two session options are still proposals. Therefore
> this repo remains in demo / not-connected mode.

---

**Status: implemented locally, not deployed.** The Waitlist Admin read endpoints listed in section D are implemented in this repository and use the existing service-role Supabase client with exact HEAD counts; no signup rows are loaded into Node for aggregate series. The public waitlist function and tables were supplied as verified external facts; this repo contains no waitlist migration. No migration was created or run. The authorization-code bridge and same-site alias remain proposals only. The standalone frontend must not assume a deployed API until deployment is separately approved.

## A. Guard verification

### Existing guards and tests

- `src/admin/admin-session.guard.ts:92-162` — `AdminSessionGuard` is an injectable NestJS guard. It reads a bearer access token first (`:114-117`), or the access cookie; it can refresh from the refresh cookie (`:118-139`). It validates the access token by calling Supabase Auth `getUser` (`:122-125`), then queries `staff_roles` for the authenticated Auth UUID and `is_active = true` (`:143-148`). It rejects missing/invalid sessions (`:141`), query errors (`:150`), and inactive/missing/invalid staff profiles (`:151-153`). It adds server-verified `req.user` and `req.staffContext` (`:155-160`).
- `src/admin/waitlist-owner.guard.ts:11-34` — `WaitlistOwnerGuard` requires `WAITLIST_ADMIN_OWNER_USER_ID` to be a UUID (`:14-17`), reads only the session-populated `req.user.id` and `req.staffContext.role` (`:19-25`), and allows only a case-insensitive UUID match (`:28-32`). It does not use request-body/query/header identity, role, email or owner flags.
- `src/admin/admin-session.guard.spec.ts:23-75` — two tests cover rejecting a customer-origin write and accepting an admin-origin staff session. Historical result from the immediately preceding implementation run: **2 passed**.
- `src/admin/waitlist-owner.guard.spec.ts:39-114` — tests owner allowed, other admin denied, absent/blank/invalid owner configuration denied, missing identity denied, missing/inactive/invalid staff rejected by `AdminSessionGuard`, invalid Auth session denied, and body-supplied owner data ignored. Last focused test run: **10 passed**.

### Guard order and endpoints (CHANGED in v3)

- `src/admin/waitlist-admin.controller.ts:109-111` applies `@UseGuards(AdminSessionGuard, WaitlistOwnerGuard)` at the controller level in precisely that order. All Waitlist Admin routes use this controller. `src/admin/admin.module.ts:5-8,13-17` registers the controller, both guards, and service.
- Public registration routes remain outside this controller. No Mission Control or other admin endpoint received `WaitlistOwnerGuard`.

## B. Session and security facts

All previously verified cookie/refresh/CSRF/CORS/owner facts are unchanged — see
[`BACKEND_CONTRACT_V1.md`](BACKEND_CONTRACT_V1.md#b-session-and-security-facts).
Both the authorization-code bridge and the same-site alias remain
**`PROPOSAL — NOT IMPLEMENTED`** — see
[`BACKEND_CONTRACT_V2.md`](BACKEND_CONTRACT_V2.md#new--b--proposal--not-implemented-verbatim-abridged-only-by-line-wrapping).

### New in v3 (verbatim)

- **Body-supplied identity:** the owner guard does not trust body identity. Implemented Waitlist endpoints do not accept identity, role or owner flags from body/query/header. Export audit identity comes only from the guard-populated `@CurrentUser()` principal.

In the bridge proposal, step 5 now reads: "The data API prefix is `/api/v1/admin/waitlist`; these data paths are implemented locally but not deployed."

## C. Owner configuration

Unchanged from v1, plus this v3 addition (verbatim):

- Implemented Waitlist routes do not accept owner/user ID, role, email, or owner flags as authorization principals. The only user ID consumed by export auditing is `@CurrentUser()` from the session guard; query/body data cannot override it.

## D. Implemented endpoint manifest (CHANGED in v3 — verbatim)

Base path: `/api/v1/admin/waitlist` (global `/api` prefix plus controller `v1/admin/waitlist`). Every endpoint is protected at controller scope by `AdminSessionGuard → WaitlistOwnerGuard`. All successful JSON routes use JSON responses; errors use `ApiExceptionFilter` envelope `{ statusCode, code, message, correlationId, error? }`. No endpoint accepts an owner identity from request data.

All query keys are allowlisted. `q` is 1–100 chars; `state` 1–120 chars; `audience` is `student | parent_guardian | institution`; `status` is `pending_verification | verified | removed`; `from`/`to` are valid ISO date or timestamp and `from <= to`; `page` is integer >=1; `pageSize` is integer 1–100, default 25. Unknown or repeated/non-string query values return 400. Service/database errors are returned as 503. Session failures return 401; active non-owner staff return 403.

| Method / path | Query / validation / defaults | Success response | Error codes / notes | Count, limits, audit |
|---|---|---|---|---|
| `GET /overview` | No query keys. | `{ total, verified, unverified, student, parentGuardian, institution, registrationGrowth, audienceDistribution, topStates, recentRegistrations, generatedAt }` | 400 unknown query; 401; 403; 503. Totals count all signups; verified and unverified are `status=verified` and `status=pending_verification` respectively; removed are in total but in neither status subtotal. | Exact server-side PostgREST HEAD counts (`select=id`, `Prefer: count=exact`) with no row payload: one total/status/audience count each, 30 daily count queries (default trend), plus per-state count queries over 37 Nigerian state/FCT labels and `Other / unlisted` + `Unspecified`. Top 10 state buckets. Recent list is the only row read: 10 max, explicit safe columns. No audit. |
| `GET /registrations` | `q?`, `audience?`, `status?`, `state?`, `from?`, `to?`, `page=1`, `pageSize=25`; strict filters and date order. | `{ items: WaitlistRegistrationSummary[], page, pageSize, total, totalPages }` | 400 invalid/unknown; 401; 403; 503. | PostgREST exact count plus `.range(offset, offset+pageSize-1)`; page size cap 100. Explicit select allowlist excludes `email_key`, token table/hash, and secrets. No audit. |
| `GET /registrations/:id` | UUID path `id`, validated before query. | `WaitlistRegistrationDetailResponse`: whitelisted signup fields plus current verification send count/timestamp; email activity is explicitly unavailable as a per-message history; consent history states current-only. | 400 invalid UUID; 401; 403; 404; 503. | One `.maybeSingle()` with explicit columns; no tokens/hash. No audit. |
| `GET /analytics` | `period=day\|week\|month` required; `from?`, `to?` ISO; defaults to 30 days ending today; maximum inclusive range 366 days. | `{ period, trend, audienceBreakdown, verificationRate, marketingSubscriptionRate, stateDistribution }`; rates are `null` when denominator is zero. | 400 invalid period/date/range/unknown key; 401; 403; 503. | Exact HEAD count queries per bucket (2 per bucket: registrations and verified), three audience counts, verification/marketing/total counts, plus bounded state counts over 37 labels plus other/unspecified. Maximum 366 daily buckets, at most 54 weekly or 13 monthly buckets; concurrency capped at 8. No signup rows materialized. State output top 10 by exact counts. Verification rate is `verified / (verified + pending_verification)` (removed excluded); marketing-consent rate is true-consent count divided by all registrations in the range and is `null` when that denominator is zero. No audit. |
| `GET /registrations/export.csv` | Same filters as list except pagination; unknown keys rejected. Requires `X-Requested-With: edupay-admin` and exact allowlisted `Origin` because export also records an audit. | CSV attachment; `text/csv; charset=utf-8`; `Cache-Control: no-store`; filename `edupay-waitlist-YYYYMMDDTHHmmssZ.csv`. | 400 invalid query; 400 `EXPORT_LIMIT_EXCEEDED`; 401; 403; 503. If audit write fails, response is not returned. | Exact HEAD count first; hard cap 5,000, no silent truncation; fetched in deterministic 500-row ranges and exact count rechecked before audit/response, with changed-count/short-read races returning 503. CSV columns and escaping in section F. Audit `waitlist.exported` with `filterNames` and `rowCount` only; no filter values or exported PII in metadata. |
| `GET /settings` | No query keys. | `{ ownerAccess, ownerUserIdReturned, senderConfiguration, waitlistConfigurationKeys, systemStatus, emailActivityAvailable, campaignManagementAvailable, consentHistoryAvailable }` | 400 unknown query; 401; 403. Database probe failure returns 200 with `systemStatus: unavailable`; does not disclose config values. | Zero-row HEAD probe; sender status reflects presence of the named sender/API-key env vars in this backend process only. The separate Edge Function config cannot be read here. No audit. |
| `GET /audit-logs` | `page=1`, `pageSize=25` (max 100), `from?`, `to?`, `action?` (must start `waitlist.` and <=120 chars). | `{ items, page, pageSize, total, totalPages }`; metadata is restricted to export filter names and row count. | 400 invalid/unknown; 401; 403; 503. | Exact count + range; staff actor and `waitlist.%` action filter. No audit of reading logs. |
| `GET /email-activity` | No query keys. | None. | 501 `FEATURE_UNAVAILABLE`; `message` and `error` explain no durable per-message delivery event source exists. Also 401/403. | No email activity is fabricated. |
| `GET /campaigns` | No query keys. | None. | 501 `FEATURE_UNAVAILABLE`; `message` and `error` explain campaign schema/queue/provider ingestion do not exist. Also 401/403. | No campaign data is fabricated. |

Count implementation: `src/admin/waitlist-admin.service.ts` uses the injected `SUPABASE_ADMIN` client. `src/common/supabase.module.ts:27-39` constructs that client with `SUPABASE_SERVICE_ROLE_KEY`; no anon-key client is used for signup data. Queries use `select('id', { count: 'exact', head: true })`, which requests exact server-side counts without returning signup rows. State distribution is bounded to the 37 Nigerian states/FCT plus exact counts for unlisted non-null values and null state; only the top 10 labels are returned. Trends are bounded as above. No raw token or `token_hash` is selected anywhere.

Controller/service implementation: `src/admin/waitlist-admin.controller.ts`, `src/admin/waitlist-admin.service.ts`. The current request error envelope is from `src/common/api-exception.filter.ts`; `FEATURE_UNAVAILABLE` is carried in `code` with the reason in both `message` and standard `error` fields.

### Type declarations

`docs/waitlist-admin-api.d.ts` describes the implemented JSON response/request shapes and explicitly unavailable features. CSV is a text attachment, not JSON. It contains no `any` types and no owner UUID value.

## E. Data support matrix (CHANGED in v3 — verbatim)

Waitlist table/column facts below are supplied as verified external input; the live waitlist migration is absent from this checkout. The API uses only existing `public.waitlist_signups` and `public.audit_logs` tables. No live DB was queried in this implementation turn.

| Feature | Data support and implementation |
|---|---|
| Overview counts / verified / pending / audience / growth / state buckets | Implemented with exact server-side `HEAD` + `count=exact` filters on `waitlist_signups`; trend is 30 daily buckets. State labels are bounded to Nigeria's 36 states plus FCT; an exact `not in` count covers other non-null state values and a separate exact count covers NULL. Top 10 buckets are returned. No registration rows are loaded for counts. |
| Registration search/list/detail | Implemented with a strict explicit `select` column allowlist, exact count and range pagination; detail selects one UUID. No `email_key`, token table/hash or raw token is selected. |
| Analytics trends and ratios | Implemented by exact HEAD count queries per period bucket and status/audience/marketing/state filters; never loads signup rows into Node. Range max is 366 inclusive days, concurrency max 8. Rates return `null` with zero denominator. |
| Email delivery summary | Per-message delivery data **UNAVAILABLE**. Detail indicates no activity log and includes only schema-backed `verification_sent_count` and `last_verification_sent_at`. |
| Delivery/bounce/failed/open/click statistics | **UNAVAILABLE**: no provider event table/webhook ingestion. `/email-activity` returns 501 `FEATURE_UNAVAILABLE`. |
| Unsubscribe activity | **UNAVAILABLE**: no unsubscribe status/ledger. No unsubscribe activity is reported. |
| Resend activity | **PARTIALLY SUPPORTED**: per-signup verification send count and last-send timestamp only; no per-attempt history. |
| Consent history | **UNAVAILABLE**: detail states current consent only; existing current booleans, notice version, and timestamps are returned. No historic timeline is fabricated. |
| Campaign create/edit/preview/test/schedule/send/statistics | **UNAVAILABLE**: no campaign, recipient, queue, idempotency, sending or event schema/service. `/campaigns` returns 501 `FEATURE_UNAVAILABLE`. |
| Verification token data | Never selected, returned or used in analytics/export. No `token_hash` or raw token access. |
| Audit log read | Implemented from `audit_logs`, filtered to staff `waitlist.%` actions, exact count/range paging. Metadata is restricted to export filter names and row count. |

## F. CSV contract (implemented) — verbatim

- Exact header/column order: `id,full_name,email,phone,audience_type,state,school_name,education_level,institution_name,institution_type,contact_role,waitlist_consent,waitlist_notice_version,waitlist_consent_at,marketing_consent,marketing_consent_at,status,verified_at,created_at`.
- Every cell is quoted; embedded quotes are doubled; records use CRLF; output is UTF-8; response content type is `text/csv; charset=utf-8` with `Cache-Control: no-store`.
- Spreadsheet-formula protection prefixes an apostrophe when the cell (after leading whitespace) begins `=`, `+`, `-`, or `@`; formula characters remain quoted as RFC 4180 cells.
- Applies the validated registration filters. **Pagination keys are not accepted for export.** Exact server-side count is checked first; >5,000 returns 400 `EXPORT_LIMIT_EXCEEDED`; rows are fetched in 500-row ranges with deterministic ordering and the exact count is rechecked to detect short-read/count races. No silent truncation.
- Filename pattern: `edupay-waitlist-YYYYMMDDTHHmmssZ.csv` (UTC timestamp compacted by implementation).
- Audit row is inserted before returning CSV: `action=waitlist.exported`, actor from `@CurrentUser()`, metadata contains only sorted filter key names and `rowCount`. Audit failure returns 503 and no export body. No filters' values, PII, email_key, tokens, hashes, secrets, or owner UUID are logged/exported.

## G. Environment / H. Migrations

Unchanged from v1 — see [`BACKEND_CONTRACT_V1.md`](BACKEND_CONTRACT_V1.md).
No migration was created or executed. The optional aggregate RPC in
[`AGGREGATE_RPC_PROPOSAL.sql`](AGGREGATE_RPC_PROPOSAL.sql) remains
**PROPOSAL ONLY, NOT EXECUTED** and is no longer needed for the implemented
exact-count approach.

## I. Files and test/build status (CHANGED in v3 — verbatim)

Files created/changed for this implementation:

- `src/admin/waitlist-admin.controller.ts` — owner-guarded controller and strict query validation.
- `src/admin/waitlist-admin.service.ts` — service-role queries, exact counts, CSV/audit, settings and 501 responses.
- `src/admin/waitlist-admin.controller.spec.ts` — owner access, validation, count behavior, export and unavailable-feature tests.
- `src/admin/admin.module.ts` — registers the new controller/service and owner guard; no other controller was changed.
- `docs/BACKEND_INTEGRATION_CONTRACT.md` — updated contract.
- `docs/waitlist-admin-api.d.ts` — types aligned to JSON response/error envelopes.

Pre-existing owner guard files retained without modification in this follow-up:

- `src/admin/waitlist-owner.guard.ts`
- `src/admin/waitlist-owner.guard.spec.ts`

Diff summary: added the owner-guarded read controller and service; added exact HEAD count series, filtered pagination/detail, settings/audit reads, audited CSV, and honest 501 responses; registered only the new controller/service/guard in AdminModule; added route/service tests and updated the integration types/contract. No migration, database record, role, shared cookie/CORS configuration, public registration route, DNS, deployment, commit or push was changed.

Tests run after implementation:

- Targeted: `npx jest --runInBand src/admin/waitlist-admin.controller.spec.ts src/admin/waitlist-owner.guard.spec.ts` — 2 suites, 24 tests passed.
- Full: `npm test -- --runInBand` — 24 suites, 257 tests passed (see exact terminal summary in handoff response).
- `npm run lint` — passed.
- `npm run build` — passed.
- `npx tsc --noEmit --incremental false` — passed.
- Cross-app regression (customer app, existing admin dashboard, Mission Control): **UNVERIFIED** — not available in this repository.
- Live Supabase query execution: **UNVERIFIED** — not run. Tests use mocked Supabase query builders; deployment configuration and live data remain to be checked by the owner.
- Dependency installation reports 21 audit findings (8 low, 13 moderate); package files were not changed.

Owner's accompanying summary: "Implemented locally on `arena/f123aa73-edupay-backend`; nothing was committed, pushed, or deployed. The new endpoints reuse the service-role client and existing guards, and no migration, role, shared cookie/CORS setting, or public registration route was changed. The tests use mocked Supabase queries. Live database behavior and cross-app regressions remain UNVERIFIED. The session bridge and same-site alias are still proposals, not implemented."

## J. Open questions / UNVERIFIED

Unchanged from v1 — see [`BACKEND_CONTRACT_V1.md`](BACKEND_CONTRACT_V1.md), plus:
frontend cookie handling and whether its deployment can host a secure
server-side BFF; owner approval for a cross-origin solution and a separately
reviewed session-bridge protocol; permission before creating/applying schema
migrations or enabling campaign sending. No campaign or consent-history endpoint
should claim the absent data exists.
