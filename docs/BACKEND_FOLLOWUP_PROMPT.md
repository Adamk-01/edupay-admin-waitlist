# Follow-up prompt — send back to the backend agent

**Why:** its `BACKEND_INTEGRATION_CONTRACT.md` confirmed that **no Waitlist Admin
endpoint exists** and that neither cross-origin option was implemented. That was
a design handoff, not the fix. Paste the block below to request the actual
implementation.

---

```text
# Follow-up — please implement the Waitlist Admin endpoints (design-only last time)

Thank you for the integration contract. It confirmed the guards and tests, but
section D says "Implemented endpoint manifest: None" and section B says the
cross-origin option implemented was "neither". That is a design handoff, not the
fix. Please now do the implementation, in Adamk-01/edupay-backend ONLY.

You still have access to exactly one repo. Do not try to fetch other repos,
Vercel, or the live database. Any fact you cannot verify from this repo must be
marked UNVERIFIED. No secret, token, password, key or owner UUID VALUE in any
output — key names only, synthetic placeholders in examples.

## 1. Implement the controller (the main missing piece)

Create the Waitlist Admin controller/service/module at base path
/api/v1/admin/waitlist, using YOUR framework conventions. At CONTROLLER level
(or on every protected method) apply:
    @UseGuards(AdminSessionGuard, WaitlistOwnerGuard)
in precisely that order. Register both guards in the module. Do NOT add
WaitlistOwnerGuard to Mission Control or other existing admin endpoints. Do NOT
mount it on public registration routes. Do NOT change shared cookie/CORS
behaviour used by the existing EduPay admin dashboard, customer app or Mission
Control.

Implement these GET routes for real, reading ONLY the existing waitlist tables
(do NOT create duplicate tables, do NOT create a migration):
  - /overview               -> OverviewResponse
  - /registrations          -> RegistrationListResponse
  - /registrations/:id      -> RegistrationDetailResponse
  - /analytics              -> AnalyticsResponse
  - /registrations/export.csv -> CSV attachment
  - /settings               -> SettingsResponse (status/key names only)
  - /audit-logs             -> AuditListResponse
  - /email-activity         -> 501 FEATURE_UNAVAILABLE with a reason
  - /campaigns              -> 501 FEATURE_UNAVAILABLE with a reason

Use the response/error shapes you already declared in
docs/waitlist-admin-api.d.ts and the global error envelope from
src/common/api-exception.filter.ts. Never fabricate a count, series or row.

## 2. Enforce the contract on every route

- Strict query-key allowlist; reject unknown keys with 400.
- Validate q (1-100), state (1-120), audience/status enums, ISO from/to with
  from <= to, page >= 1, pageSize 1-100 (default 25).
- Export: same validated filters, hard cap 5,000 rows, return 400
  EXPORT_LIMIT_EXCEEDED instead of silently truncating. CSV columns exactly in
  the order from contract section F; exclude email_key, token_hash, raw tokens,
  owner UUID and any secret. RFC 4180 quoting, CRLF, UTF-8, and formula-injection
  protection for values starting with = + - or @. Content-Type
  text/csv; charset=utf-8.
- Write a `waitlist.exported` entry to public.audit_logs on successful export,
  with filter names + row count only, never exported values/PII.
- Never return token_hash, raw verification tokens, email_key, owner UUID, or
  configuration VALUES. Settings reports only configured/not_configured and key
  names.
- Never accept an owner/user ID, role, email or is_owner flag from body, query
  or header as an authorization principal. Identity comes only from the
  session-populated req.user / req.staffContext.
- Use grouped aggregate queries for trends/counts; do not load the whole table
  into application memory as a pseudo-aggregate.
- Preserve RLS deny-by-default; no new permissive policies for
  anon/authenticated.
- Apply the existing X-Requested-With: edupay-admin + exact allowlisted Origin
  checks to non-GET requests; do not weaken them.

## 3. Tests (run them, report real output)

- owner can access every implemented route;
- another admin gets 403 on every owner-only route;
- unauthenticated gets 401; invalid/expired session gets 401;
- a body/query-supplied user ID, role or owner flag cannot change authorization;
- registrations search/filters/pagination/detail;
- analytics period validation;
- export: CSV accuracy, filters respected, 5,000-row cap, formula injection
  escaped, audit_logs entry written, unauthorized export rejected;
- 501 responses carry FEATURE_UNAVAILABLE and a reason, no invented data.
Then run your repo's full test suite, lint, build and tsc --noEmit and paste
actual pass/fail counts. Mark cross-app regression as UNVERIFIED.

## 4. Cross-origin session — do NOT improvise

Your contract correctly said the existing cookie cannot span vercel.app,
edupayafrica.com.ng and onrender.com without SameSite=None, and that weakening
cookie/Origin/CSRF checks is forbidden. Do NOT change cookie flags or
ADMIN_CORS_ORIGINS now, and do NOT invent a bridge endpoint from the contract.

Instead return a WRITTEN protocol proposal for owner review covering:
authorization-code or equivalent exchange tied to the existing Supabase Auth
session, state/nonce, single-use storage, replay protection, TTL, revocation,
the exact first-party cookie flags the frontend BFF should set, and which
backend endpoint (new or existing) the BFF calls with which headers. Also list
the exact config/DNS changes the owner must approve for the same-site alias
alternative. Label the whole section "PROPOSAL — NOT IMPLEMENTED".

## 5. Rules that still apply

No second authentication system. No duplicate waitlist tables. No referral
functionality. No fabricated statistics. No unnecessary PII. No secrets in
output. No commit, push, deploy, DNS change or executed migration. Back up files
before editing. If an important decision is uncertain, stop and report it.

## 6. What to return (paste in full in your final answer)

An UPDATED BACKEND_INTEGRATION_CONTRACT.md whose section D contains a real
"IMPLEMENTED endpoint manifest" (actual paths, actual response bodies, actual
error codes), plus: the session-bridge proposal, file list + diff summary, test
and build output, and anything still UNVERIFIED. Also paste the updated
docs/waitlist-admin-api.d.ts if any type changed. There is no shared repo, so
only your chat reply reaches the frontend agent.
```
