# EduPay Waitlist Admin — Launch Control

Standalone Next.js + TypeScript frontend. **It is deliberately separate from the
EduPay customer app, the existing EduPay admin dashboard, and EduPay Mission
Control.** Nothing in this repository integrates with those applications.

> **Current status: Phase 1 complete; backend endpoints implemented LOCALLY but
> NOT DEPLOYED; owner approved the BFF session bridge + a staging deploy, but
> neither is built or deployed yet; real-data integration still blocked.** See
> [`docs/OWNER_DECISIONS.md`](docs/OWNER_DECISIONS.md) and
> [`docs/BFF_SESSION_DESIGN.md`](docs/BFF_SESSION_DESIGN.md) (PROPOSAL — NOT
> IMPLEMENTED). The current handoff
> ([`docs/BACKEND_INTEGRATION_CONTRACT.md`](docs/BACKEND_INTEGRATION_CONTRACT.md),
> v3) confirms the owner-guarded read endpoints, correct guard order and 257
> passing tests — with **mocked** Supabase queries. Nothing was committed, pushed
> or deployed; both cross-origin session options remain proposals; live DB
> behaviour and cross-app regressions are UNVERIFIED. See
> [`docs/HANDOFF_STATUS.md`](docs/HANDOFF_STATUS.md) for the gap analysis and
> [`docs/PHASE1_ARCHITECTURE_AUDIT.md`](docs/PHASE1_ARCHITECTURE_AUDIT.md) for
> the original audit.
> The Overview still shows clearly labelled **demo** data. All six other pages
> show honest "no live data" states. `NEXT_PUBLIC_DATA_MODE=live` removes the
> demo figures entirely instead of inventing production numbers.

## Routes

`/` (labelled demo Overview), `/registrations`, `/analytics`, `/campaigns`,
`/email-activity`, `/exports`, `/settings`. The six section routes are real
pages but currently render honest unavailable states with the exact reason and
prerequisites from the backend contract — no fabricated records. The typed,
gated API client in `src/lib/api/` is **server-only** and deliberately throws
before any network call: `BACKEND_READY = false` because the backend is not
deployed and no session solution is approved (see `src/lib/api/client.ts`).

## Important

This is a frontend prototype with illustrative demo data only. It is **not**
connected to production waitlist records, staff authentication, email, or
campaign sending. Do not deploy as a production admin tool until backend
authorization, CSRF/CORS, and cross-domain authentication have been implemented
and tested. Never put owner IDs or private credentials in frontend variables.

**No commit, push, deployment, DNS change or production database migration has
been performed as part of this work.** All changes are local files on the
working branch.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional; all values are safe placeholders
npm run dev
```

Open http://localhost:3000.

Checks:

```bash
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript
npm run build         # production build
npm audit             # dependency advisories
```

## Environment variables

`.env.example` contains **variable names and safe placeholders only** — no real
hosts, keys, tokens, owner UUIDs or credentials. Nothing secret may ever be
placed in a `NEXT_PUBLIC_*` variable, because those are inlined into the
browser bundle at build time.

| Variable | Used | Purpose |
|---|---|---|
| `NEXT_PUBLIC_DATA_MODE` | Yes | `demo` (default) = clearly labelled sample UI; `live` = honest "backend not connected" state. Any other value falls back to `demo`. |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public origin of this app, used for metadata. Placeholder only. |
| `EDUPAY_API_BASE_URL` | Reserved | Server-side base URL of the existing EduPay backend. **Reserved for Phase 5**: the final name and endpoint contract must be confirmed against the backend repository before any integration code is written. |

Owner UUIDs, staff session secrets, service-role keys, mail-provider keys and
private keys belong in the **backend's** server-side configuration, never here.

## Data mode

- `demo` (default): renders the existing dashboard visual identity — deep navy
  navigation, warm off-white workspace, restrained orange actions, green/amber
  status indicators — with a **non-dismissible** "DEMO · NO BACKEND / NOT
  CONNECTED" label. Every figure on screen is explicitly described as sample
  data. No network calls are made.
- `live`: renders a single honest panel stating that live data is unavailable
  until the verified, owner-protected backend API is connected. **No figures
  are fabricated.**

## Security posture (current)

- `robots: noindex, nofollow, nocache` in `src/app/layout.tsx`.
- Security headers in `next.config.ts`: CSP, HSTS, `nosniff`, `X-Frame-Options:
  DENY`, `Referrer-Policy: no-referrer`, COOP/CORP, Permissions-Policy.
  `connect-src 'self'` — no third-party browser calls.
- `poweredByHeader: false`, `reactStrictMode: true`.
- `next` / `eslint-config-next` pinned to the patched `15.5.29`.
- **Not present yet:** authentication, authorization, session handling,
  middleware, API routes, tests and CI. Deployment-level access control
  (Vercel password protection / SSO) is still required if this is deployed
  while it is a demo.

## Deployment preparation (not executed)

Proposed production origin: `https://waitlist-admin.edupayafrica.com.ng`.

Prepared only as documentation and `.env.example`. **DNS has not been changed
and nothing has been deployed.** Before deployment the following must be
settled (see the audit document):

1. Read access to the private `Adamk-01/edupay-backend` repository, so the
   existing `AdminSessionGuard`, `WaitlistOwnerGuard`, their tests, and the
   session cookie/CORS/CSRF configuration can be verified.
2. A same-site session architecture. `edupay-admin-livid.vercel.app`,
   `waitlist-admin.edupayafrica.com.ng` and the Render backend have no common
   registrable domain, so the existing session cookie cannot be shared without
   weakening `SameSite`. See §6 of the audit for the smallest safe option.
3. Confirmation of the owner-only API contract, including the configured owner
   UUID check performed **on the backend**, never from a request body or a
   frontend variable.

## Documentation

- `AUDIT.md` — code/security audit of this frontend (previous session).
- `docs/PHASE1_ARCHITECTURE_AUDIT.md` — backend, database, auth, email and
  cross-origin architecture audit, plus the endpoint/data gap analysis.
- `docs/BACKEND_INTEGRATION_CONTRACT.md` — **current** backend contract (v3:
  endpoints implemented locally, not deployed).
- `docs/BACKEND_CONTRACT_V1.md` — v1 handoff (no endpoints), preserved.
- `docs/BACKEND_CONTRACT_V2.md` — v2 delta (aggregate blocker + session proposals).
- `docs/waitlist-admin-api.d.ts` — v3 API types (verbatim, provenance).
- `docs/HANDOFF_STATUS.md` — what the contract confirmed, what was built, what
  is still blocked.
- `docs/BACKEND_FOLLOWUP_PROMPT.md` — first prompt asking for real endpoints.
- `docs/BACKEND_CONTRACT_V2.md` — second backend handoff (verbatim delta) +
  assessment of the aggregate blocker.
- `docs/BACKEND_UNBLOCK_PROMPT.md` — current prompt to send back: clarifies
  exact server-side counting needs no migration.
- `docs/AGGREGATE_RPC_PROPOSAL.sql` — OPTIONAL read-only aggregate RPC;
  **PROPOSAL ONLY, NOT EXECUTED**, needs explicit owner permission. Not needed
  for the v3 exact-count implementation.
- `docs/OWNER_DECISIONS.md` — owner's 2026-11-09 decisions (BFF bridge, staging
  deploy, schema deferred).
- `docs/BFF_SESSION_DESIGN.md` — concrete bridge protocol; **PROPOSAL — NOT
  IMPLEMENTED**, open items need security sign-off.
- `docs/BACKEND_NEXT_STEPS_PROMPT.md` — current pasteable prompt for the backend
  agent (bridge endpoints, staging deploy, live smoke test).
