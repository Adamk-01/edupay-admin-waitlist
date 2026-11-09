# Unblock prompt — send back to the backend agent (v2 blocked on aggregates)

**Why:** its second handoff says implementation is blocked because grouped
aggregates need an RPC/migration, and loading rows into Node is prohibited.
That reading is too strict — see the verified facts below. Paste the block.

---

```text
# Clarification + implementation request — you can build this WITHOUT a migration

Thanks for the v2 contract and the session-bridge proposal; it is recorded and
awaits owner approval. But the aggregate blocker is over-constrained. Three
verified facts resolve it. You still have access to ONE repo only, no live DB,
no other repos. Anything unverifiable = UNVERIFIED. No secret/token/key/owner
UUID VALUE in output — key names only.

## Verified facts you can rely on

1. The live Supabase DB DOES have the waitlist tables (verified 2026-11-09 via
   information_schema): public.waitlist_signups, waitlist_verification_tokens,
   waitlist_request_log. The migration simply is not in YOUR repo. You do NOT
   need to create tables, and must NOT create duplicate ones.

2. The existing `waitlist` Edge Function in the public waitlist project ALREADY
   does exact server-side aggregation with no row payload and no SQL migration:
       HEAD /rest/v1/waitlist_request_log?select=id&bucket_key=eq.X&route=eq.Y
       Prefer: count=exact        -> read Content-Range: */N
   (supabase/functions/waitlist/index.ts:417-430 and the rest() HEAD branch at
   :246-250). The same pattern works on waitlist_signups with filters such as
   status=eq.verified, audience_type=eq.student, marketing_consent=eq.true,
   created_at=gte.<iso>&created_at=lt.<iso>, state=eq.<state>.
   My earlier instruction "use grouped aggregate queries, not full-table loads"
   meant: DO NOT materialise signup rows in Node. It did NOT prohibit exact
   server-side count queries. HEAD + Prefer: count=exact satisfies the intent.

3. That same source (:222-240) shows waitlist reads MUST use the SERVICE ROLE
   key: RLS is enabled with ZERO policies and NO grants to anon/authenticated.
   Verify which key src/common/supabase.module.ts:27-39 constructs the
   SupabaseClient with. An anon-key client will silently return zero rows.
   Use a server-side service-role client for these reads; never expose the key
   to a browser.

## Implement NOW, with ZERO migration

Create the Waitlist Admin controller at /api/v1/admin/waitlist with
@UseGuards(AdminSessionGuard, WaitlistOwnerGuard) in PRECISELY that order at
controller level (or every protected method); register both guards in the
module. Do NOT touch Mission Control / other admin endpoints, public
registration routes, shared cookie flags, ADMIN_CORS_ORIGINS or any existing
app behaviour. Always use an explicit `select=` column allowlist that excludes
email_key, token_hash, raw verification tokens, owner UUID and config values.

Implement for real:
  - GET /registrations          filtered list, Range pagination, exact count
  - GET /registrations/:id      detail (UUID validated)
  - GET /settings               key names / configured-status only
  - GET /audit-logs             paginated
  - GET /registrations/export.csv  same validated filters, hard cap 5,000 rows,
                                400 EXPORT_LIMIT_EXCEEDED instead of truncation,
                                RFC 4180 quoting + CRLF + UTF-8, formula
                                injection escaping for = + - @, Content-Type
                                text/csv; charset=utf-8, and a
                                `waitlist.exported` audit_logs entry with
                                filter names + row count ONLY
  - GET /email-activity and GET /campaigns  -> 501 FEATURE_UNAVAILABLE with a
                                reason; never invent delivery/bounce counts
  - GET /overview and GET /analytics: exact server-side counts via the HEAD
                                pattern above. Bound the trend to <= 366 days
                                and the state distribution to a bounded,
                                validated state allowlist (or top N via a
                                bounded set of per-state count queries). State
                                explicitly in the contract which method you
                                used and the exact bucket/state limits. Never
                                silently omit a series, never fabricate a
                                value, never load rows into Node.
                                OPTIONAL: if the owner approves
                                docs/AGGREGATE_RPC_PROPOSAL.sql (frontend repo,
                                PROPOSAL ONLY, NOT EXECUTED), you may call those
                                read-only RPCs instead. Do not apply that SQL
                                yourself.

Every route: strict query-key allowlist (unknown key -> 400); validate q 1-100,
state 1-120, audience/status enums, ISO from/to with from<=to, page>=1,
pageSize 1-100 default 25; global error envelope from
src/common/api-exception.filter.ts; never accept owner/user ID, role, email or
is_owner from body/query/header as an authorization principal; keep
X-Requested-With: edupay-admin + exact allowlisted Origin on writes; preserve
RLS deny-by-default (no new permissive policies).

## TESTS — run them and paste real output

owner allowed on every route; another admin 403; unauthenticated 401;
invalid/expired session 401; body/query-supplied identity ignored;
search/filters/pagination/detail; analytics period + range validation;
export accuracy, cap, injection escaping, audit entry, unauthorized rejection;
501 responses carry a reason. Then full suite, lint, build, tsc --noEmit.
Mark cross-app regression UNVERIFIED. No endpoint test may be claimed unrun.

## Session bridge

Your "PROPOSAL — NOT IMPLEMENTED" is recorded. Do NOT improvise the
authorize/exchange endpoints, do NOT add Redis, do NOT change cookie/CORS,
and do NOT change DNS. It needs owner approval for the bridge endpoints,
callback origin, atomic single-use store, BFF encrypted session store, TTL and
revocation strategy. Same-site alias alternative likewise stays a proposal.

## Rules that still apply

No second auth system. No duplicate waitlist tables. No referral functionality.
No fabricated statistics. No unnecessary PII. No secrets in output. No commit,
push, deploy, DNS change or executed migration. Back up before editing.

## If you still believe nothing is implementable

Then implement AT LEAST the single simplest route that needs no aggregate
(GET /settings: owner-access status + configured/not_configured key names,
guarded in the correct order), with its tests, and stop. Report precisely which
of the remaining routes you consider blocked and the single smallest change
that would unblock each. Do not return another design-only document.

## Return (paste in full in your final answer)

An UPDATED BACKEND_INTEGRATION_CONTRACT.md whose section D contains a REAL
"IMPLEMENTED endpoint manifest" (actual paths, actual response bodies, actual
error codes, the count method used and its limits), plus file list + diff
summary, test/build output, and anything UNVERIFIED. There is no shared repo —
only your chat reply reaches the frontend agent.
```
