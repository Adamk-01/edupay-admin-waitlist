# Owner decisions — 2026-11-09

Recorded from the structured decision prompt after the third backend handoff
(v3: endpoints implemented locally, not deployed). These are **decisions and
approvals**, not evidence that anything has been built or deployed.

| # | Question | Decision | What it authorises | What it does NOT authorise |
|---|---|---|---|---|
| 1 | Cross-origin session | **BFF authorization-code bridge** | Design and implement a same-origin BFF that stores the existing Supabase session server-side; a host-only first-party cookie for the Waitlist Admin origin; new backend one-time-code endpoints. | No second authentication system, no new user store, no `SameSite=None` weakening, no cookie `Domain` widening, no `ADMIN_CORS_ORIGINS` removal or relaxation, no change to existing EduPay staff apps' login. |
| 2 | Deployment | **Yes — deploy to a staging environment first** | The backend agent may commit/push/deploy its branch to **staging**, then run a real service-role smoke test of one read endpoint plus cross-app regression checks. | No production deployment, no DNS change, no production data migration, no frontend deployment on Vercel (Vercel scopes are still `Access denied`). |
| 3 | Campaign / email / consent schema | **Defer — keep honest 501 states** | Leave `/campaigns` and `/email-activity` as 501 `FEATURE_UNAVAILABLE` with reasons; consent history stays current-state-only. | No migration, no DDL execution, no fabricated delivery/bounce/unsubscribe/campaign data. |

## Immediate consequence for this repo

`BACKEND_READY` in `src/lib/api/client.ts` remains **`false`**. Approval of an
approach is not implementation. Four separate facts must all be true before any
network call is made:

1. `BACKEND_LOCAL_IMPLEMENTATION_VERIFIED` — ✅ true (v3, 257 mocked tests pass).
2. `SESSION_BRIDGE_IMPLEMENTED` — ❌ false (`/auth/authorize` + `/auth/exchange`
   do not exist; the atomic single-use store does not exist).
3. `BACKEND_DEPLOYED` — ❌ false (staging deploy approved, not performed).
4. `LIVE_DB_VERIFIED` — ❌ false (tests use mocked Supabase queries).

The demo Overview stays labelled; all six section routes keep their honest
"no live data" states. No BFF route handler, no credentials and no secret were
added. No commit, push, deploy or migration was performed in this repository.

## Follow-up artefacts

- [`BFF_SESSION_DESIGN.md`](BFF_SESSION_DESIGN.md) — concrete protocol for review.
  **PROPOSAL — NOT IMPLEMENTED.** Several parameters still need explicit
  security sign-off before code is written.
- [`BACKEND_NEXT_STEPS_PROMPT.md`](BACKEND_NEXT_STEPS_PROMPT.md) — pasteable
  prompt for the backend agent covering the bridge endpoints, the additive
  origin allowlist, staging deploy and the live smoke test.
- [`HANDOFF_STATUS.md`](HANDOFF_STATUS.md) §7 — how these decisions change the
  remaining work.
