# Next-steps prompt for the backend agent (after v3)

**Context to paste with it:** the owner has now made three decisions (below).
This prompt is for the agent with access to exactly `Adamk-01/edupay-backend`.
Send the two documents below with it if it needs the reference protocol:
`docs/BFF_SESSION_DESIGN.md` and `docs/OWNER_DECISIONS.md` (frontend repo — it
cannot read them, so paste relevant sections if needed).

---

```text
# v3 accepted — next steps: owner decisions + bridge endpoints + staging deploy

Thank you. v3 is recorded: the read endpoints, correct guard order, exact HEAD
counts, audited CSV and 257 passing tests are all accepted. No change to the
data endpoints is requested in this step.

OWNER DECISIONS (2026-11-09):
  1. Cross-origin session: BFF authorization-code bridge APPROVED as the
     approach. Same-site alias NOT selected; do not build it.
  2. Deployment: STAGING deploy APPROVED (commit/push/deploy your branch to the
     staging environment, then a real service-role smoke test of one read
     endpoint plus cross-app regression checks). PRODUCTION deploy, DNS changes
     and production migrations are NOT approved.
  3. Schema: DEFERRED. Do NOT create/apply any campaign, email-event,
     unsubscribe or consent-history table. Keep /campaigns and
     /email-activity as honest 501 FEATURE_UNAVAILABLE.

SCOPE RULES (unchanged): you have ONE repo. Anything you cannot verify from it
= UNVERIFIED. No secret, API key, token, password, owner UUID VALUE or
connection string in any output — key names and safe placeholders only. No
second authentication system, no new user store, no super_admin promotion, no
duplicate waitlist tables, no referral functionality, no fabricated data. Back
up files before editing.

## IMPORTANT: approval is not implementation

Do NOT assume the bridge already exists, and do NOT improvise a half-bridge.
The frontend repo holds a concrete protocol in docs/BFF_SESSION_DESIGN.md
(PROPOSAL — NOT IMPLEMENTED). Its §7 lists OPEN ITEMS that still need owner
sign-off (durable store choice, staging hostnames, exact BFF origin, session
key rotation, revocation strategy, rate limits, rollback). If any of those
block a safe implementation of the endpoints below, implement only what is
unblocked, say precisely which item blocks the rest, and stop. Do not invent
hostnames, origins or store configuration.

## STEP 1 — report what you can verify (no code yet)

Before editing, answer in writing:
  (a) exact staging backend origin used by this repo's config, or UNVERIFIED;
  (b) which ADMIN_CORS_ORIGINS entries exist and whether an ADDITIVE entry for
      the BFF origin is required by your exact-Origin checks (retain all current
      entries — no relaxation, no removal);
  (c) whether any atomic single-use store (Redis or equivalent) is present and
      configurable in this repo, or whether it must be provisioned externally;
  (d) whether the existing staff login is reachable from a staging BFF origin;
  (e) the exact existing logout path and its required headers.
Mark anything you cannot see as UNVERIFIED. Do not print values of secrets.

## STEP 2 — implement the two owner-guarded bridge endpoints

Only if Step 1 shows they can be implemented safely. Add them to the existing
Waitlist Admin controller or a sibling controller with the SAME guard order:
    @UseGuards(AdminSessionGuard, WaitlistOwnerGuard)
Register in AdminModule. Never mount on public registration routes; never add
WaitlistOwnerGuard to Mission Control or other admin endpoints.

  GET  /api/v1/admin/waitlist/auth/authorize
       Query: state, nonce, code_challenge (S256), redirect_uri.
       - Require an EXACT allowlisted redirect_uri (report the configured value
         as a key name, not a guess). Reject anything else.
       - Reject missing/malformed/short state, nonce or challenge.
       - Identity comes ONLY from guard-populated req.user / req.staffContext.
       - Create a 60-second one-time code bound to the verified Auth UUID,
         state, nonce, PKCE challenge, callback URI and session generation.
       - Store ONLY a SHA-256 hash of the code in an atomic single-use store
         (SET NX EX 60 + atomic consume/GETDEL). No process memory if the
         deployment is multi-instance.
       - Redirect with code + state ONLY. Never put a token, owner UUID, email
         or role in a URL.

  POST /api/v1/admin/waitlist/auth/exchange
       - Content-Type: application/json, X-Requested-With: edupay-admin, exact
         allowlisted Origin.
       - Body: { code, code_verifier, redirect_uri }. No identity/role fields.
       - Atomically consume-and-delete the code; mark redeemed BEFORE responding.
       - Verify hash, TTL, state, nonce, PKCE S256 challenge, callback URI,
         session generation, still-active Supabase session and still-active
         owner staff row. Replay/expiry/mismatch -> 400/401/403.
       - Return the EXISTING Supabase session credentials to the BFF SERVER
         only, over TLS. Never to browser JavaScript.
       - Log waitlist.auth.started / exchanged / rejected / logout with
         correlation IDs only: no tokens, codes, state, owner UUID or PII.

Do NOT change shared cookie flags (SameSite, Domain, Secure, HttpOnly), do NOT
relax Origin/CSRF checks, do NOT change DNS, and do NOT alter the data
endpoints from v3. If an additive ADMIN_CORS_ORIGINS entry is required, report
the exact change for owner approval rather than editing deployment config
yourself unless you already have explicit owner permission for that specific
change.

## STEP 3 — tests (run them, paste real output)

owner allowed; other active admin 403; unauthenticated 401; invalid session
401; replay rejected; expired code rejected; state / nonce / PKCE /
redirect_uri mismatch rejected; body-supplied identity ignored; no token in
any redirect; exact-Origin and X-Requested-With enforcement on exchange;
atomic single-use behaviour under two concurrent exchanges. Then the full
suite, lint, build, tsc --noEmit, and .d.ts check. Mark cross-app regression
UNVERIFIED until Step 5.

## STEP 4 — staging deploy (owner-approved)

Commit/push/deploy YOUR branch to the STAGING environment only. Report the exact
staging base URL (a hostname is not a secret), the deployment identifier and
whether WAITLIST_ADMIN_OWNER_USER_ID is set there (yes/no only, NEVER the
value). Do NOT deploy to production. Do NOT change DNS. Do NOT apply any DDL.
Do NOT print any env value.

## STEP 5 — live smoke test and regression (owner-approved)

Using a real service-role client against staging, call ONE implemented read
endpoint (suggest GET /settings, then GET /overview if it succeeds) with a
verified owner session. Report: HTTP status, whether the response shape matches
docs/waitlist-admin-api.d.ts, whether counts are real (not mocked), and any
error envelope/correlation ID. Then run or explicitly mark UNVERIFIED the
cross-app checks for the customer app, existing admin dashboard and Mission
Control: login still works, cookies unchanged, no new errors. Do NOT reveal
any registration PII in the output — status codes and shapes only.

## STEP 6 — return

Paste IN FULL in your final answer (there is no shared repo):
  - the Step 1 verification report;
  - an UPDATED BACKEND_INTEGRATION_CONTRACT.md with a real implemented
    endpoint manifest INCLUDING the two bridge endpoints (actual paths, actual
    responses, actual error codes), and the staging URL;
  - file list + diff summary;
  - test/build output; live smoke test result; regression result;
  - anything still UNVERIFIED and which §7 open items still need owner sign-off;
  - updated docs/waitlist-admin-api.d.ts if any type changed.

If Step 1 shows the bridge cannot be implemented safely yet, still do STEPS 4–5
(staging deploy + live smoke test) and return the Step 1 report with the precise
blockers, so the owner can sign off the remaining decisions.
```
