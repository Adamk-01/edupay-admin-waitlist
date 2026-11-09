# Handoff brief — for an AI agent with access to ONLY `Adamk-01/edupay-backend`

**How to use:** copy everything inside the block below and paste it as the first
message to that agent. It is self-contained: all facts from other repositories,
Supabase and the frontend are embedded, and anything the agent cannot verify
from its single repository is explicitly marked `UNVERIFIED`.

> **Version note (2026-11-09):** revised because the backend agent can see only
> `Adamk-01/edupay-backend`. The earlier draft wrongly assumed it could also
> read `edupay-admin`, `edupay-customer`, `edupay-waitlist`, the frontend repo,
> or the Supabase dashboard. Do not use the earlier draft.

---

```text
# EduPay Waitlist Admin — backend implementation handoff (SINGLE-REPO SCOPE)

## 0. SCOPE OF YOUR ACCESS — READ THIS FIRST

You have access to EXACTLY ONE repository: Adamk-01/edupay-backend.

You DO NOT have access to:
  - Adamk-01/edupay-admin-waitlist  (the standalone frontend I am building)
  - Adamk-01/edupay-admin          (existing EduPay admin dashboard)
  - Adamk-01/edupay-customer       (customer application)
  - Adamk-01/edupay-waitlist       (public waitlist website + Edge Function)
  - Adamk-01/Edupay                (older FastAPI monorepo)
  - Vercel, the Supabase dashboard, or any live database

Do NOT waste time trying to clone, fetch, curl, `gh api`, or search for those
repos — they are not visible to you. Everything you need to know about them is
supplied below as VERIFIED EXTERNAL INPUT. Treat it as authoritative unless your
own repository's source or migrations contradict it; if they do, say so
explicitly and quote the file/line. Anything you cannot verify from your single
repository MUST be reported as `UNVERIFIED` — never guessed, never invented.

I am a separate agent building the frontend. There is NO shared repository
between us. The ONLY way I receive your work is if you PASTE IT INTO YOUR FINAL
ANSWER. Creating files in your repo is useful for the owner, but useless to me
unless the full contents are also in your reply.

Create `BACKEND_INTEGRATION_CONTRACT.md` and `waitlist-admin-api.d.ts` in your
repo's `docs/` folder AND paste both files in full in your final message.

## 1. NON-NEGOTIABLE PROJECT RULES (from the project owner — obey all)

- Keep the Waitlist Admin a completely separate application. Do NOT integrate
  it into EduPay Mission Control, the customer app or the existing EduPay admin
  dashboard. Do not break any of those applications.
  NOTE: you cannot test those apps from this repo. Limit your changes to the
  waitlist/admin module and avoid modifying shared auth/config used by other
  apps. Report cross-app regression testing as `UNVERIFIED`, never as passing.
- Reuse the EXISTING EduPay staff authentication. Do NOT introduce a second
  authentication system, second user store, or parallel login flow.
- The designated owner account stays an EXISTING `admin` account. Do NOT promote
  it to `super_admin`.
- Enforce owner-only access ON THE BACKEND. Frontend gating alone is insufficient.
- The existing WaitlistOwnerGuard ALREADY EXISTS IN YOUR REPOSITORY. INSPECT IT
  and USE IT. Do NOT create another version. Inspect its tests too. Verify that
  every protected endpoint applies guards in this exact order:
      AdminSessionGuard -> WaitlistOwnerGuard
  If you cannot find the guard, STOP and report `UNVERIFIED` — do not write a
  replacement.
- The backend must resolve the authenticated staff identity FROM THE SESSION and
  compare it against the CONFIGURED OWNER UUID. NEVER trust a user ID, role,
  email or owner flag supplied in a request body, query string or header.
- Do NOT create duplicate waitlist tables. They already exist (section 2).
  Do NOT create a migration that recreates them.
- Do NOT introduce referral functionality.
- Do NOT fabricate production statistics or registration records.
- Do NOT expose private registration information unnecessarily.
- NEVER print, log, paste into files, or return in your final answer any
  password, API secret, service-account credential, private key, auth token,
  session token, SMTP password, OAuth client secret, service-role key, or the
  owner UUID VALUE. Config KEY NAMES are fine; values are not. Use synthetic
  placeholders in every example.
- Do NOT commit, push, deploy, change DNS, or run production database migrations
  without the owner's explicit permission. Implement locally, then report a file
  list and diff summary. Propose required migrations as SQL in a file, clearly
  marked NOT EXECUTED.
- Back up files before editing. Do not overwrite working features. Work in
  small, verifiable stages.
- If an architecturally important fact is uncertain, STOP and report it instead
  of guessing.

## 2. VERIFIED EXTERNAL INPUT (you cannot see these sources — do not re-fetch)

A separate read-only audit of the live Supabase project and the public waitlist
repository established the following. NO row data, NO PII and NO secret values
were read. If your repo contains the same migrations, use YOUR source as the
primary truth and report any discrepancy.

LIVE DATABASE: Supabase project "EduPay", ACTIVE_HEALTHY, 17 applied migrations.

Existing waitlist tables — REUSE, DO NOT DUPLICATE:
- public.waitlist_signups
    id, full_name, email, email_key, phone, audience_type, state, school_name,
    education_level, institution_name, institution_type, contact_role,
    waitlist_consent, waitlist_notice_version, waitlist_consent_at,
    marketing_consent, marketing_consent_at, status, verified_at,
    verification_sent_count, last_verification_sent_at, created_at, updated_at
  Constraints: audience_type IN ('student','parent_guardian','institution');
  status IN ('pending_verification','verified','removed');
  waitlist_consent = true;
  marketing_consent=false <=> marketing_consent_at IS NULL;
  status='verified' <=> verified_at IS NOT NULL.
  Unique index on email_key; index on (status, created_at DESC).
- public.waitlist_verification_tokens
    id, signup_id, token_hash (SHA-256 hex, 64 chars), expires_at,
    consumed_at, created_at. Raw tokens are NEVER stored.
  NEVER return token_hash or any raw token in a listing, analytics or export.
- public.waitlist_request_log  id, bucket_key, route, created_at.

SECURITY POSTURE: RLS enabled on ALL 30 public tables; ZERO RLS policies;
`anon` has NO SELECT/INSERT/UPDATE/DELETE grants on any table; `authenticated`
has NO SELECT grants. Deny-by-default — data is reachable only with the service
role from trusted server code. Do NOT add permissive RLS policies exposing
signups to anon/authenticated.

STAFF / AUDIT:
- public.staff_roles(user_id uuid, role text, is_active boolean, created_at,
  updated_at). CHECK role IN ('admin','super_admin','operator','operations',
  'finance','finance_approver','analyst','support'). Live distribution:
  1 admin, 1 operator; NO super_admin row.
- public.audit_logs(id, actor_user_id, actor_type, action, resource_type,
  resource_id, metadata jsonb, created_at); actor_type IN
  ('customer','staff','system'). Action style is `domain.action`, e.g.
  `wallets.exported`, `pii.revealed`, `staff.invited`. A
  `prevent_audit_log_mutation` trigger exists. REUSE for export / campaign-send
  / settings-change auditing.
- 34 SECURITY DEFINER functions in public (admin_* etc.), mostly with empty
  search_path; NONE of the 35 public functions is executable by anon or
  authenticated.
- public.admin_operational_settings(setting_key, setting_value jsonb,
  updated_by, updated_at) contains only `operational_preferences`. There is NO
  owner UUID column anywhere in the DB, so the configured owner UUID is almost
  certainly a backend env var — VERIFY IN YOUR SOURCE and report the KEY NAME
  only, never the value.

WHAT DOES NOT EXIST (verified): NO campaign tables, NO campaign recipients, NO
email templates, NO scheduled sends, NO email-delivery/bounce/failed/open/click
records, NO unsubscribe ledger, NO consent HISTORY table (only current consent
state + notice version + two timestamps). `notifications` and `push_*` tables
are keyed to customer auth.users and are NOT reusable — waitlist signups are
deliberately not accounts.

PUBLIC REGISTRATION ENDPOINT (lives OUTSIDE your repo — do not recreate or
modify it): Supabase Edge Function `waitlist`, ACTIVE, version 10,
verify_jwt=false, POST /waitlist with action register | verify | resend.
Token TTL 24h, SHA-256 hashed, single-use via consumed_at, resend cooldown
10 min, per-IP/per-email rate limits, 8 KiB body cap, generic responses
(no enumeration), HTML escaping. CORS allowlist is only REFLECTED in
Access-Control-Allow-Origin; a disallowed origin falls back to the first exact
allowlist entry and the handler never returns 403 before side effects.
clientIp() trusts the first x-forwarded-for value. withinLimit() fails open on
a failed count read and is non-atomic (HEAD count -> POST insert). Email is sent
via the Resend REST API. Config KEY NAMES (no values): WAITLIST_FROM_EMAIL,
WAITLIST_NOTIFY_EMAIL, WAITLIST_NOTICE_VERSION, WAITLIST_SITE_URL,
WAITLIST_ALLOWED_ORIGINS, RESEND_API_KEY.
Your NEW owner-protected endpoints belong in YOUR backend application, not in
that public Edge Function.

SUPABASE AUTH FLAGS (external, no values): jwt_exp 3600, refresh-token rotation
enabled, unverified sign-ins disallowed, TOTP MFA available, signup enabled,
breached-password check off, captcha off, session inactivity timeout 0,
redirect allowlist includes localhost:3000, 127.0.0.1:3000 and a Render OAuth
callback. These are CUSTOMER auth flags, not proof of staff session behaviour.

FRONTEND CONTEXT (external, for contract design only): standalone Next.js 15
app, currently NO auth and NO API client, with a labelled demo mode and an
honest "not connected" state. It will consume whatever contract you define.

## 3. TWO BLOCKERS YOU MUST RESOLVE (from YOUR repo)

BLOCKER A — the auth layer was never inspectable from outside. Inspect and
report, with file paths + line references:
  1. AdminSessionGuard: behaviour, how it reads/validates the session.
  2. WaitlistOwnerGuard: behaviour and how it resolves the configured owner UUID,
     PLUS its existing tests (file, cases, actual pass/fail results).
  3. Guard ORDER on every existing protected endpoint:
     AdminSessionGuard -> WaitlistOwnerGuard. Fix any violations.
  4. Existing staff auth: session representation (cookie vs bearer), TTL,
     rotation, invalidation, and role resolution against staff_roles.
  5. Cookie flags ACTUALLY SET in your code: name, Domain, Path, SameSite,
     Secure, HttpOnly, Max-Age/Expires. Credentialed CORS config (allowlist KEY
     NAMES, Access-Control-Allow-Credentials). CSRF protection (token type,
     exact header name, double-submit vs server-side, Origin/Sec-Fetch-Site
     checks).
  6. Where the owner UUID is configured (KEY NAME only), and whether any
     endpoint currently trusts a body-supplied user ID or role.
  7. Whether ANY owner-protected waitlist admin endpoints already exist in your
     repo. If yes, give exact paths; do not duplicate them.
  If your repo has no env template or config file for a fact above, report
  `UNVERIFIED` with the file you expected to find. Do NOT infer from other apps.

BLOCKER B — cross-origin session. Target origins:
  - https://edupay-admin-livid.vercel.app        (eTLD+1: vercel.app)
  - https://waitlist-admin.edupayafrica.com.ng   (eTLD+1: edupayafrica.com.ng)
  - production EduPay backend (Render, *.onrender.com)
These share NO common registrable domain, so a Domain-scoped cookie cannot be
shared. `SameSite=None; Secure` + credentialed cross-site CORS would WEAKEN
cookie security and depend on third-party cookies; the owner explicitly forbids
weakening auth/cookies to make cross-subdomain login work.
You can only change BACKEND-side configuration. The frontend origins' own
cookie behaviour is OUT OF YOUR SCOPE — mark it `UNVERIFIED`.

Explicitly answer: "Can the existing session cookie work across these three
origins without SameSite=None?" If no, do not weaken the cookie. Implement the
smallest safe BACKEND-side part of one of:
  Preferred — same-site: prepare the backend to be reachable on a subdomain of
  edupayafrica.com.ng (e.g. api.edupayafrica.com.ng) via host alias / reverse
  proxy, so the existing session cookie can be `HttpOnly; Secure; SameSite=Lax
  (or Strict); Domain=.edupayafrica.com.ng`. Change the backend allowlist,
  cookie domain and CORS config. DO NOT change DNS — return the exact host
  alias and config keys the owner must approve.
  Fallback — session bridge: implement a thin authorization-code / session
  exchange endpoint that a frontend server-side BFF can call, so the browser
  holds only a first-party HttpOnly SameSite=Lax cookie on
  waitlist-admin.edupayafrica.com.ng and NO token/secret reaches the browser.
  This is a session bridge, NOT a second auth system.
State which option you implemented and the exact deployment config still needed.
Never introduce a second authentication system.

## 4. IMPLEMENT ONLY GENUINELY MISSING ENDPOINTS

Design around YOUR actual framework, routing, module layout and naming
conventions. These are FUNCTIONAL REQUIREMENTS, not assumed endpoint names.
Report what already exists before adding anything.

  - Overview stats: total / verified / unverified / student / parent_guardian /
    institution counts, registration growth, audience distribution, top states,
    recent registrations.
  - Registration listing: search by name+email; filters by audience,
    verification status, state, registration date; pagination; detail view.
  - Registration detail: consent state, notice version, consent timestamps, and
    any email activity supportable from real records.
  - Analytics: trends by day/week/month, audience breakdown, verification rate,
    marketing subscription rate, state distribution.
  - CSV exports: all eligible / verified / by audience / respecting current
    filters. Authorized, audit-logged, row-capped, no token_hash.
  - Settings: owner access info (NO owner UUID returned to the browser), email
    sender CONFIGURATION STATUS (configured / not configured — never values),
    waitlist configuration (key names only), audit log, system status.
  - Audit log read endpoint.
  - Campaign management and Email Activity: NO backing data exists. Do NOT
    fabricate. Either (a) propose the required schema + services + provider
    webhook ingestion as SQL/DDL + design notes in a file, NOT EXECUTED, and
    report these endpoints cannot be honest yet; or (b) implement read
    endpoints returning an explicit `available: false` / 501 with a reason.
    Never invent delivery, bounce or failed counts.
  - Consent history: only current consent exists. Either propose a history table
    (DDL only, NOT EXECUTED) or expose "current consent only" explicitly.

For EVERY protected endpoint:
  - existing staff session authentication first;
  - AdminSessionGuard THEN WaitlistOwnerGuard, in that order;
  - validate all inputs (types, enums, date ranges, search length);
  - enforce pagination limits (state the cap);
  - validate filters against the real column set; reject unknown filters;
  - never accept an owner/user ID, role or is_owner flag from the request;
  - return only PII needed for the view; never return token_hash, raw tokens,
    email_key, or secret/config values;
  - consistent error shapes + HTTP codes (401 unauthenticated, 403 non-owner,
    400 invalid, 404 not found, 429 rate limited, 500/503 unavailable) —
    report them exactly;
  - record sensitive actions (exports, campaign sends, settings changes) in
    audit_logs using a `waitlist.*` action name;
  - never expose verification tokens in listings or analytics;
  - campaign send requires an EXPLICIT confirmation parameter and must exclude
    `marketing_consent = false` (plus removed/unverified records per the
    eligibility rules you define). Never send to the entire list without that
    explicit confirmation.

## 5. TESTS TO RUN AND REPORT (from THIS repo only)

Authentication: existing admin can authenticate; designated owner can access;
ANOTHER admin cannot access owner-only endpoints; unauthenticated users are
denied; direct API requests cannot bypass authorization (no body-supplied
identity); invalid/expired sessions fail safely.
Registrations: search, each filter, pagination, detail, consent accuracy.
Campaigns: test email, unsubscribed exclusion, explicit confirmation, failed
delivery handling — OR state clearly that the subsystem does not exist.
Exports: CSV accuracy, filters respected, unauthorized exports rejected,
audit_logs entry written.
Technical: YOUR repo's TypeScript check, lint, tests and production build, with
actual command output and pass/fail counts.
Report cross-app regression (customer app, existing admin dashboard, Mission
Control) as `UNVERIFIED — cannot be tested from this repository`. Do not claim
unrun tests. Do not claim you verified the frontend's cookie behaviour.

## 6. WHAT I NEED BACK — paste full contents in your FINAL MESSAGE

Produce `BACKEND_INTEGRATION_CONTRACT.md` in your repo AND paste it in full.
It MUST contain:

A. GUARD VERIFICATION — file paths + line refs for AdminSessionGuard,
   WaitlistOwnerGuard and their tests; test results; guard order on every
   protected endpoint; fixes made.
B. SESSION & SECURITY FACTS — cookie name + Domain/Path/SameSite/Secure/
   HttpOnly/TTL; session invalidation; CSRF mechanism and the EXACT header/token
   name the frontend must send; credentialed CORS allowlist KEY NAMES (no
   values); chosen cross-origin solution; exact host aliases / config changes
   the owner must approve; explicit `UNVERIFIED` markers for anything outside
   your repo.
C. OWNER CONFIG — KEY NAME of the configured owner UUID (never the value); how
   the backend resolves staff identity; confirmation the account remains `admin`
   and was NOT promoted; confirmation no endpoint trusts body-supplied identity.
D. ENDPOINT MANIFEST — one row per endpoint: method | path | auth required |
   guards (in order) | query/body params with types + validation + defaults |
   pagination cap | success response JSON shape | error codes | audit action |
   rate limit. Then TypeScript interfaces for EVERY request and response in a
   fenced ```ts block (copy-pasteable, NO `any`), including a shared error type
   and enums for audience/status, the base path, and a full example URL using a
   SYNTHETIC host only.
E. DATA SUPPORT MATRIX — per requested feature: SUPPORTED (columns/aggregation
   used) or UNAVAILABLE (exact reason + proposed DDL/config). Explicitly cover
   email delivery summary, delivery/bounce/failed statistics, unsubscribe
   activity, resend activity, consent history, and campaign
   create/edit/preview/test/schedule/send/statistics.
F. CSV CONTRACT — exact column order, headers, escaping rules, row cap,
   content-type, filename pattern, filter application.
G. ENVIRONMENT — KEY NAMES of every env var the frontend must know, marked
   SERVER-ONLY or PUBLIC, with safe placeholders. NO VALUES. State which holds
   the API base URL and whether browser calls are direct or must be proxied
   through a frontend server-side BFF.
H. MIGRATIONS — proposed SQL DDL in a fenced ```sql block, explicitly marked
   NOT EXECUTED, with the permission needed to apply.
I. FILES CHANGED / CREATED, diff summary, and test + build results.
J. OPEN QUESTIONS / everything UNVERIFIED.

Also produce `waitlist-admin-api.d.ts` containing ONLY the TypeScript types from
(D), so I can drop it into the frontend. Paste it in full too.

MINIMUM VIABLE HANDOFF if you cannot finish everything: sections A, B, C, D
plus the `.d.ts` file, pasted in full. That alone unblocks the frontend.

## 7. ACCEPTANCE CRITERIA

- No second auth system, no duplicate waitlist tables, no referrals, no
  fabricated statistics, no unnecessary PII/token exposure.
- Owner-only enforcement is server-side and covered by tests you actually ran.
- Cross-origin solution does NOT set SameSite=None and does NOT rely on
  third-party cookies.
- No secret, token, password, key or owner UUID value appears in output or diff.
- No commit, push, deploy, DNS change or executed migration.
- Everything outside Adamk-01/edupay-backend is marked `UNVERIFIED`.
- The contract is complete enough that the frontend agent can implement real
  pages, loading/empty/error/retry states, pagination, search, filters and
  exports WITHOUT a single follow-up question.
- Both files are PASTED IN FULL in your final answer (no shared repo exists).
```

---

## What to bring back to me

Paste that agent's **`BACKEND_INTEGRATION_CONTRACT.md`** and **`waitlist-admin-api.d.ts`** in your next message. There's no shared repo, so the chat reply is the only transport. With those I can build the real pages, typed API client, loading/empty/error/retry states, pagination, filters, exports and auth wiring here — without guessing an endpoint, field name or cookie behaviour.

If the agent is time-constrained, tell it to do only **§6 A/B/C/D + the `.d.ts`** (the minimum viable handoff); that's enough for me to start.
