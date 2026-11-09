# EduPay Waitlist Admin — Project Audit

**Date:** 2026-11-09
**Repository:** `Adamk-01/edupay-admin-waitlist` (branch `arena/afa8c9f6-edupay-admin-waitlist`, commit `e117675`)
**Scope:** all 13 files in commit `e117675`, the dependency tree, build/lint/type-check output, and the connected Supabase/Vercel accounts where readable. (`AUDIT.md` itself is the only added file.)

---

## 1. Executive summary

This is a **single-page, fully static Next.js 15 prototype**. The entire application is three source files (85 lines total): a 55-line client component, an 11 KB hand-written stylesheet squeezed into 6 lines, and a 6-line layout. There is no API layer, no data fetching, no authentication, no middleware, no tests, and no CI. Every number, chart, date, and table row is a hard-coded literal.

**Verdict:** As a *visual mock-up*, it succeeds — it installs, builds, type-checks and renders a polished, responsive dashboard. As an *admin tool*, it is not fit for production and should not be presented as one. It also ships a **critical** framework vulnerability.

| Severity | Count | Headline |
|---|---|---|
| Critical | 1 | Pinned `next@15.5.27` has an unauthenticated RCE advisory |
| High | 5 | No auth wall; no security headers / `noindex`; mostly non-functional admin UI; hard-coded data contradicting live backend; misleading KPI presentation |
| Medium | 5 | Broken `.env.example`; accessibility failures; tooling/CI gaps; unused framework + unmaintainable CSS; state/semantics issues |

> The README is candid about this being a prototype. That warning is accurate for the **code**, but note that a live EduPay backend with real `waitlist_*` tables and a public waitlist Edge Function does exist in the connected Supabase account (see §4). The demo KPIs (2,450 registrations) have no relationship to real data (2 rows at audit time). Screenshots of this console can easily be mistaken for a live admin system.

---

## 2. Verification performed

| Check | Command / method | Result |
|---|---|---|
| Install | `npm ci` | 328 packages, clean |
| Production build | `npm run build` | **Pass** — 4 static pages, `/` = 6.02 kB, 109 kB First Load JS |
| Lint | `npm run lint` | **0 errors, 3 warnings** |
| Type-check | `npx tsc --noEmit` | **Pass** (`strict: true`) |
| Dependency audit | `npm audit --json` | **8 vulnerabilities: 1 critical, 1 high, 6 moderate** |
| Remediation dry-run | `npm audit fix --dry-run` | Dev-chain moderates fixable; `next` fix needs an explicit version bump |
| Secret scan | `git grep` over tracked files | No credentials, tokens, owner IDs or `NEXT_PUBLIC_*` in the repo |
| Built output | `.next/server/app/index.html`, `.next/static/css/*.css` | No `robots`/`noindex` meta; no security headers; 16,520 B compiled CSS |
| Backend | Supabase connector (read-only SQL, config, functions) | See §4 |
| Hosting | Vercel connector | **Partially blocked** — see §5 |

Build lint warnings: unused `ArrowUpRight` import (`src/app/page.tsx:3`), anonymous default exports in `eslint.config.mjs:5` and `postcss.config.mjs:1`.

---

## 3. Findings

### F-01 — CRITICAL — Pinned Next.js version carries an RCE advisory

**Evidence:** `package.json:4` pins `"next": "15.5.27"` and `"eslint-config-next": "15.5.27"`. `npm audit` reports:

- `GHSA-2464-fhr4-w9xw` — *Unauthenticated Remote Code Execution in Image Optimization API when SVG files are used* (**critical**) — [advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw)
- `GHSA-p3m5-59mp-jv5r` — *Denial of Service in App Router using Server Actions* (**high**) — [advisory](https://github.com/advisories/GHSA-p3m5-59mp-jv5r)
- Transitive `postcss` (bundled under `next`) — **high**, 4 advisories including `GHSA-r28c-9q8g-f849` (path traversal / arbitrary `.map` disclosure) and `GHSA-qx2v-qp2m-jg93` (XSS via unescaped `</style>`).
- Six **moderate** dev-only findings (`minimatch` glob-amplification DoS, `GHSA-g3hv-75wg-m249`) reached through `@typescript-eslint/*` → ESLint 9.

**Exploitability nuance:** this repo has no `next/image` usage, no Server Actions, no API routes and no user-controlled CSS, so there is no obvious reachable attack path *in this codebase*. But the vulnerable framework is still shipped, and the app is intended to grow into a real admin console — leaving a known critical in the lockfile is unacceptable.

**Fix:** bump `next` and `eslint-config-next` to **15.5.29** (patch-level, non-major; verified as the audit-suggested fix version). Because the version is exact-pinned, `npm audit fix` will *not* do it — `npm audit fix --force` reports `Will install next@15.5.29, which is outside the stated dependency range`. Edit `package.json` deliberately, then `npm install && npm audit fix && npm run build && npm audit`. `npm audit fix` alone clears the six dev-chain moderates. Also note `next` is now at 16.4.5; a planned major upgrade is advisable, but 15.5.29 is the immediate patch.

### F-02 — HIGH — No authentication, authorization, or route protection

**Evidence:** `git ls-files` shows no `middleware.ts`, no `src/app/api/**`, no auth library, no session handling. `src/app/page.tsx:1` is `"use client"`; the build report marks `/` as `○ (Static) prerendered as static content`. `src/app/layout.tsx:3` sets only title/description.

Anyone who can reach the deployed URL gets the complete "Launch Control" console. The only guardrails are cosmetic text: the `DEMO ENVIRONMENT` badge (`page.tsx:30`), the dismissible `Preview workspace` banner (`page.tsx:32`), and the README warning. The banner can be dismissed by any visitor with one click and is not persisted; after dismissal nothing on screen says the data is fake.

**Impact:** if this is ever deployed on a public domain — or wired to real waitlist data without a redesign — it becomes an unauthenticated PII dashboard. Client-side state is not an authorization boundary.

**Fix:** put the protection on the server: `middleware.ts` session check + server-side role lookup against a staff/admin table, `robots: { index: false, follow: false }`, and deployment-level access restriction (Vercel password protection / SSO) even while it is only a demo. Never gate on a client-side `useState` flag or an owner ID in a `NEXT_PUBLIC_*` variable (the README correctly warns against this).

### F-03 — HIGH — The "admin" UI is largely non-functional and misleading

**Evidence:** `active` state (`page.tsx:20`) is used only to change the `<h1>` at `page.tsx:31`. All seven nav items (`page.tsx:5-9, 27`) render the *same* Overview dashboard; all content below the heading is unconditional.

- `View registrations` and `New campaign` (`page.tsx:31`) only change the heading — the "New campaign" button appears to open a campaign composer but shows the overview.
- `View all` (`page.tsx:45`) and `View project setup` (`page.tsx:46`) likewise.
- Three `<button>` elements have **no `onClick` at all**: notification bell (`:30`), "Last 30 days" period selector (`:33`), "Filters" (`:45`).
- `Visit help centre ↗` (`:28`) is a `<span>`, not a link; `MoreHorizontal` (`:28`) is decorative, not a menu; pagination `‹ 1 ›` (`:45`) is plain text.
- Search (`:21, 45`) works, but only over the 5 hard-coded rows.

**Impact:** a reviewer, investor, or operator can reasonably believe registration management, campaign sending, exports, filters and settings exist. This is a product-trust risk, not just a missing feature.

**Fix:** either implement real routes/pages (or disable those controls with an explicit "coming soon" state), or label the whole build as a static design preview and remove the interactive affordances that imply capability.

### F-04 — HIGH — Hard-coded, stale, and internally inconsistent data

**Evidence (all literals in `page.tsx`):**

- `2,450` total, `1,890` verified, `560` awaiting (`:35-37`) — arithmetic is self-consistent (77.1%).
- `Institutions` stat card says **184** (`:38`), while the audience-breakdown legend says **331 institutions** (`:42`) for the same 2,450 total (1,421 + 698 + 331 = 2,450). Contradiction.
- `Stat()` (`:52`) prepends a green `↗` to *every* change value, including "Awaiting verification" where `22.9%` is a **share**, not growth — a green upward arrow on a pending-verification metric is misleading.
- Chart (`:17, 41`) is 24 arbitrary percentages (30–100) drawn against a `0 / 625 / 1,250 / 1,875 / 2,500` axis with only 5 date labels; bars `i>18` are coloured "hot" by an unexplained threshold.
- Donut (`:42`) is a hard-coded `conic-gradient(... 58% ... 86%)` with separately hard-coded legend percentages; readiness `2/5` and `40%` progress (`:46`) are literals.
- `MONDAY, NOVEMBER 9, 2026` (`:31`) is today's date, hard-coded — it is wrong from tomorrow onward. All five sample rows are dated Nov 7–9 2026 (`:11-15`).
- Nav badge `2.4k` (`:27`), "Last 30 days" (`:33`), "© 2026 EduPay Africa" (`:47`) are all static.

**Backend comparison:** the live Supabase `EduPay` project's `waitlist_signups` table contained **2 rows** at audit time (plus 2 verification tokens, 15 rate-limit log rows). The demo claims 2,450.

**Fix:** one typed data source (`type WaitlistStats = ...`), derive every KPI, chart segment, label and pagination figure from it, and mark demo fixtures explicitly. If the real backend is eventually connected, all these literals must be deleted, not overwritten.

### F-05 — HIGH — Missing `noindex` and security headers for an internal tool

**Evidence:** `src/app/layout.tsx:3` has no `robots` metadata; built HTML head contains only `charset`, `viewport`, `description` and `title`. `next.config.ts:3` is `const config: NextConfig = {};` — no `headers()`, no `redirects()`, no CSP. No `public/robots.txt`.

**Impact:** a public deployment is indexable by search engines, frameable by third parties, and has no CSP defence-in-depth. For something branded "Private launch control" that is a bad default.

**Fix:** at minimum
```ts
export const metadata: Metadata = { /* ... */, robots: { index: false, follow: false } };
```
plus `headers()` for `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` / CSP `frame-ancestors 'none'`, and a restrictive CSP. Combine with deployment-level password protection (F-02).

### F-06 — MEDIUM — `.env.example` is broken

**Evidence:** `cat -A .env.example` shows a **single line** containing literal backslash-`n` sequences:
```
# Configure after backend auth/API design is finalized.\nEDUPAY_API_BASE_URL=\n$
```
There are no real newlines. Copying it to `.env` produces one comment line and **no defined variable**. Additionally, nothing in `src/` reads `EDUPAY_API_BASE_URL` (no `process.env` usage anywhere), so the file documents an API that does not exist yet.

**Fix:** use real line breaks, add a commented example value, and only document variables the code actually consumes. `.gitignore` (`.env*` + `!.env.example`) is correct — keep it.

### F-07 — MEDIUM — Accessibility failures (WCAG 2.2 AA)

**Evidence, measured from `src/app/globals.css:3`:**

| Foreground / background | Contrast | AA requirement |
|---|---|---|
| `#9aa5af` on `#ffffff` (muted labels, statfoot, table foot) | **2.51:1** | 4.5:1 |
| `#a1abb5` on `#ffffff` (chart axis/dates) | **2.33:1** | 4.5:1 |
| `#8995a1` on `#ffffff` (subtitles, breadcrumb) | **3.05:1** | 4.5:1 |
| `#718091` on `#ffffff` (table cells) | **4.04:1** | 4.5:1 |
| `#d87543` on `#ffffff` (orange "View all"/"setup" links) | **3.21:1** | 4.5:1 |

- Font sizes: **7 px (×7), 8 px (×15), 9 px (×18)** dominate; 40 of 55 declarations are ≤9 px. Body copy at 7–8 px is not legible at normal viewing distance.
- Icon-only buttons with **no accessible name**: hamburger (`:30`), bell (`:30`), mobile close (`:25`), notice dismiss (`:32`). Only the scrim has `aria-label` (`:23`). Total `aria-label` occurrences: **1**.
- Search input (`:45`) has only a `placeholder`, no `<label>`/`aria-label`.
- `<label className="muted-label">` (`:26, 27`) is used as a section heading with no associated form control — invalid label semantics; use a heading or `<span>`.
- Nav has no `aria-current="page"` (`:27`); `<th>` has no `scope="col"` (`:45`); no `type="button"` on any button (12 literal `<button>` tags, one of which is a `nav.map` template generating 7 nav items).
- Mobile drawer: when closed, `.sidebar` is only `transform: translateX(-100%)` (`globals.css:5`). It stays in the accessibility tree and tab order, with no `inert`/`aria-hidden`, no focus trap, no Escape handling, no focus return, and no `aria-expanded` on the hamburger.

**Fix:** raise base type to ≥12–14 px, darken muted colours to ≥4.5:1, label every icon button and input, add `aria-current`/`scope`, and implement a proper dialog/drawer pattern (or use `inert` on the closed sidebar).

### F-08 — MEDIUM — Tooling, dependency-hygiene and repo gaps

- No tests of any kind, no test framework, no CI workflow. `package.json:3` scripts are only `dev`, `build`, `start`, `lint` — no `typecheck` or `test`.
- `lint` is bare `eslint` with **no `--max-warnings 0`**, so the 3 existing warnings pass silently in CI. `next build` also reports them but still exits 0.
- `eslint.config.mjs:2` imports `@eslint/eslintrc`, which is **not declared** in `package.json`; `npm ls` shows it only as a transitive dependency of `eslint@9.39.5`. It works by hoisting luck and can break on any reinstall/dedupe. Either declare it or move to native flat config.
- `eslint@9.39.5` is flagged deprecated by npm (ESLint 10.14.0 is current); `@types/node@20` while the sandbox runs Node 22; no `engines`/`packageManager`/`.nvmrc`.
- `next.config.ts` begins with a **UTF-8 BOM** (`EF BB BF`) — harmless here but noise in diffs.
- One commit only ("Initial EduPay waitlist admin upload"), no LICENSE, no SECURITY.md, no CONTRIBUTING, no favicon (404 on `/favicon.ico`), minimal README with no architecture or env instructions.
- No `error.tsx`, `loading.tsx`, or custom `not-found.tsx` (build falls back to the default `/_not-found`).

### F-09 — MEDIUM — Framework dead weight and unmaintainable styling

- Tailwind v4 (`tailwindcss`, `@tailwindcss/postcss`) is installed and processed — `@import "tailwindcss"` at `globals.css:1` produces a 16,520 B compiled stylesheet containing Tailwind `@layer` blocks — but **zero Tailwind utility classes** are used in the JSX. Every `className` is a bespoke name (verified: 64 distinct custom class strings, no utilities).
- All 11,208 B of CSS is written on **5 physical lines** (`globals.css:2-6`), with line 3 alone at **10,038 characters**. This makes review, diffs and targeted overrides effectively impossible.
- `src/app/page.tsx` is 55 lines, but line 45 is 1,261 characters, line 46 is 887 and line 41 is 690; all five helper components (`:52-55`) are one-liners. Readability and future modification cost are high.
- Unused `ArrowUpRight` import (`:3`). `key={p.email}` (`:45`) uses email as an identity key — unsafe once real data allows duplicate/changed emails.

**Fix:** either adopt Tailwind utilities properly or remove Tailwind + PostCSS plugin entirely and keep plain CSS; split the stylesheet and TSX into readable files/components; add a stable `id` to records.

### F-10 — MEDIUM — Client-state and semantics details

The whole page is `"use client"`, shipping all fixture data and markup to the browser (bundle is still small at 109 kB First Load JS, so this is a design concern rather than a performance problem). `notice` dismissal (`:20, 32`) is in-memory only and reappears on reload. Decorative `<i>` elements are used for bars, gridlines, avatars and status dots rather than `span`/`div` with `aria-hidden`. No error boundary or loading state.

---

## 4. Adjacent live backend (Supabase) — read-only observations

The repo has **no** Supabase client, no `fetch`, and no env reads, so the README's "not connected to production waitlist records" is accurate *for this code*. However, the connected account has an **active `EduPay` project** with a live waitlist implementation (17 migrations, including `create_waitlist_schema` on 2026-11-06). Relevant if this repo is intended to become its admin console.

**Good practices observed:**
- RLS is enabled on **all 30 `public` tables** (`rls_disabled = 0`); there are **zero RLS policies**, and across all 30 tables `anon` has no `SELECT` or write grants and `authenticated` has no `SELECT` grants — a proper deny-by-default posture.
- Of 35 functions in `public`, **34 are `SECURITY DEFINER`**; none of the 35 is executable by `anon` or `authenticated`. Most set an empty `search_path` (mitigating search-path hijacking).
- Waitlist verification tokens are stored as SHA-256 hashes of 32 random bytes; the Edge Function validates inputs, escapes HTML in emails, sets `Cache-Control: no-store`, limits body size, and applies per-IP/per-email rate limits.
- Auth config: JWT expiry 3600 s, refresh-token rotation enabled, unverified sign-ins disallowed, TOTP MFA available.

**Risks worth addressing:**
1. **CORS is not enforced server-side.** The `waitlist` Edge Function (v10, `verify_jwt: false` — intentionally public) computes `Access-Control-Allow-Origin` from an allowlist, but falls back to `allowList[0]` for a disallowed origin and **never rejects the request**. Non-browser clients, and cross-site simple requests using `Content-Type: text/plain` (the handler parses the raw body regardless of content type), can still trigger registration / verification / resend and outbound email. Add an explicit `Origin` allowlist check that returns 403 before any side effect.
2. **Rate limiting is fragile:** `clientIp()` trusts the first `x-forwarded-for` value (spoofable if the proxy does not overwrite it); `withinLimit()` **fails open** when the count read fails and is non-atomic (HEAD count → POST insert), so concurrent/error paths can exceed the limits. `waitlist_request_log` has no visible retention/cleanup policy.
3. **Legacy API keys still active:** both the legacy `anon` and legacy `service_role` JWTs (long-lived, ~2036 expiry) coexist with modern publishable/secret keys. Retire the legacy `service_role` key if nothing depends on it, and rotate any key that has been shared.
4. **Auth config hardening:** `disable_signup: false`, `password_hibp_enabled: false`, `security_captcha_enabled: false`, `sessions_inactivity_timeout: 0`, `security_update_password_require_current_password: false`; redirect allowlist includes `http://localhost:3000/**` and `http://127.0.0.1:3000/*` in a live project. For an admin-facing system, restrict signups, enable breached-password checks/captcha, add a session inactivity timeout, and separate dev redirect URIs from production.
5. **Secret-handling note:** the management API returns third-party OAuth/SMTP/webhook secrets in plaintext to a caller holding the token used for this audit. No values are reproduced in this report. Treat that token as highly privileged, keep it out of logs/tickets, and rotate anything that may have been exposed.
6. **Naming/scope mismatch:** this repo's fixture data (2,450 signups, 5 sample people) describes the same `waitlist_signups` domain as the live backend, which had 2 rows. Document clearly which system is authoritative to avoid stakeholder confusion.

*Limitation:* the Edge Function body returned by the connector was truncated in the middle, so the `handleVerify` / insert paths were not fully reviewed. Statements above are based on the visible portions and database/config inspection.

---

## 5. Limitations of this audit

- **Vercel could not be inspected.** `validate_credential` succeeded and `get_authenticated_user` worked, but `list_projects`, `list_deployments`, `list_domains` and `list_user_events` all returned **"Access denied … token may not have the required permissions"**, both with and without the team ID. I therefore **could not verify** whether this app is deployed, which URL/domains serve it, what env vars are configured, or whether a production alias is publicly reachable — which is directly relevant to F-02/F-05. Please review the token's scopes (or the Vercel dashboard) and confirm no public deployment of an unauthenticated admin console exists.
- No browser-driven visual regression, axe/Lighthouse run, or penetration testing was performed; accessibility findings are code- and contrast-calculation-based.
- Dependency findings come from `npm audit` metadata as of 2026-11-09, not from exploit reproduction.
- No live HTTP requests were made against the Supabase Edge Function or any deployment.

---

## 6. Prioritized remediation plan

**Immediately (hours)**
1. Bump `next` + `eslint-config-next` to `15.5.29`, run `npm audit fix`, re-run `build` / `lint` / `tsc` / `npm audit` until clean (F-01, F-08).
2. Fix `.env.example` newlines; remove the unused `ArrowUpRight` import; declare `@eslint/eslintrc` (F-06, F-08, F-09).

**Before any deployment (days)**
3. Add `middleware.ts` session + server-side role check, `robots: noindex`, and security headers; restrict the deployment itself (F-02, F-05).
4. Decide the product truth: either implement real pages behind the nav, or disable/label every inert control and add a persistent "STATIC PREVIEW" watermark that cannot be dismissed (F-03).
5. Confirm the Vercel token scopes and audit actual deployment/env/domain configuration (§5).

**Before connecting real data (weeks)**
6. Replace all literals with a typed server-side data layer; derive KPIs/charts/pagination; add a stable record `id`; never expose owner IDs or service keys in `NEXT_PUBLIC_*` (F-04, F-09).
7. Harden the waitlist Edge Function: server-side Origin validation, proxy-trusted client IP, atomic/fail-closed rate limiting, log retention; retire legacy `service_role` key and tighten auth config (§4).
8. Split the CSS and TSX into maintainable files; fix contrast/type sizes, labels, focus management and table semantics (F-07, F-09).
9. Add tests, a `typecheck`/`test` script, `--max-warnings 0`, CI running all of the above, plus LICENSE / SECURITY.md / architecture README (F-08).

---

## 7. What is already done well

- `strict: true` TypeScript, clean `tsc --noEmit`, clean production build, small client bundle (109 kB First Load JS).
- Responsive layout with three sensible breakpoints (1100 / 820 / 560 px) and a mobile drawer concept.
- No secrets, credentials, owner IDs or `NEXT_PUBLIC_*` values committed; `.gitignore` correctly excludes `.env*`, `.next/`, `.vercel/`.
- The README explicitly and honestly warns that this is a frontend prototype with no auth/backend, and warns against frontend credentials.
- `layout.tsx` sets `lang="en"` and page metadata; `next-env.d.ts`, tsconfig paths, ESLint flat config are conventional.
- The live backend shows real security engineering: RLS deny-by-default, restricted SECURITY DEFINER functions, hashed verification tokens, input validation, HTML escaping, and rate limiting.
