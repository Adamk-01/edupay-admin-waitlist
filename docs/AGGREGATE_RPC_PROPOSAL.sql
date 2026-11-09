-- ============================================================================
-- PROPOSAL ONLY — NOT EXECUTED — REQUIRES EXPLICIT OWNER PERMISSION
-- EduPay Waitlist Admin: narrowly scoped, READ-ONLY aggregate helpers.
-- Authored 2026-11-09 by the frontend agent, from the verified live schema.
-- ============================================================================
-- Purpose: unblock GET /overview and GET /analytics with exact grouped
-- aggregates, without loading signup rows into Node and without any new data
-- table. This is OPTIONAL: the same figures can be produced with exact
-- server-side PostgREST `HEAD` + `Prefer: count=exact` queries (see
-- docs/BACKEND_UNBLOCK_PROMPT.md), which need no migration at all.
--
-- Verified live schema (2026-11-09): public.waitlist_signups has
--   id, audience_type, status, state, marketing_consent, created_at, ...
--   audience_type IN ('student','parent_guardian','institution')
--   status IN ('pending_verification','verified','removed')
-- RLS is enabled on all public tables with ZERO policies and NO grants to
-- anon/authenticated. Therefore these helpers are SECURITY DEFINER and MUST be
-- revoked from PUBLIC/anon/authenticated and granted only to service_role.
--
-- DO NOT APPLY without the owner's explicit approval and a migration review.
-- No table is created, no existing table is altered, no referral field exists.
-- ============================================================================

-- 1. Overview: one row of exact counts --------------------------------------
CREATE OR REPLACE FUNCTION public.waitlist_admin_overview()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'total',               count(*),
    'verified',            count(*) FILTER (WHERE status = 'verified'),
    'unverified',          count(*) FILTER (WHERE status = 'pending_verification'),
    'student',             count(*) FILTER (WHERE audience_type = 'student'),
    'parentGuardian',      count(*) FILTER (WHERE audience_type = 'parent_guardian'),
    'institution',         count(*) FILTER (WHERE audience_type = 'institution'),
    'marketingSubscribed', count(*) FILTER (WHERE marketing_consent = true),
    'generatedAt',         now()
  )
  FROM public.waitlist_signups;
$$;

-- 2. Trend by day / week / month, bounded to <= 366 days --------------------
CREATE OR REPLACE FUNCTION public.waitlist_admin_trend(
  p_period text,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (bucket date, registrations bigint, verified bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT date_trunc(
           CASE WHEN p_period IN ('day','week','month') THEN p_period ELSE 'day' END,
           s.created_at
         )::date                                        AS bucket,
         count(*)::bigint                              AS registrations,
         count(*) FILTER (WHERE s.status = 'verified')::bigint AS verified
  FROM public.waitlist_signups s
  WHERE s.created_at >= p_from
    AND s.created_at <  p_to
    AND p_to > p_from
    AND (p_to - p_from) <= interval '366 days'
  GROUP BY 1
  ORDER BY 1;
$$;

-- 3. State distribution (top N, capped) ------------------------------------
CREATE OR REPLACE FUNCTION public.waitlist_admin_state_distribution(p_limit int DEFAULT 10)
RETURNS TABLE (state text, registrations bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(nullif(btrim(s.state), ''), 'Unknown') AS state,
         count(*)::bigint                                AS registrations
  FROM public.waitlist_signups s
  GROUP BY 1
  ORDER BY 2 DESC, 1
  LIMIT least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

-- 4. Lock execution down to the trusted server role ------------------------
REVOKE ALL ON FUNCTION public.waitlist_admin_overview() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.waitlist_admin_trend(text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.waitlist_admin_state_distribution(int) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.waitlist_admin_overview() TO service_role;
GRANT EXECUTE ON FUNCTION public.waitlist_admin_trend(text, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.waitlist_admin_state_distribution(int) TO service_role;

COMMENT ON FUNCTION public.waitlist_admin_overview() IS
  'Read-only exact waitlist counts for the owner-protected admin API. Never exposed to anon/authenticated.';
COMMENT ON FUNCTION public.waitlist_admin_trend(text, timestamptz, timestamptz) IS
  'Read-only grouped registration trend, bounded to 366 days. Never exposed to anon/authenticated.';
COMMENT ON FUNCTION public.waitlist_admin_state_distribution(int) IS
  'Read-only grouped state distribution, capped at 50 rows. Never exposed to anon/authenticated.';

-- ============================================================================
-- Review checklist before ANY application (owner + migration reviewer):
--   * Confirm the function owner is the table owner (SECURITY DEFINER scope).
--   * Confirm REVOKE leaves no PUBLIC/anon/authenticated EXECUTE grant.
--   * Confirm the backend calls /rest/v1/rpc/<name> with the SERVICE ROLE key,
--     server-side only, never from browser JavaScript.
--   * Confirm p_period/p_from/p_to validation at the API layer as well.
--   * Confirm no raw token, token_hash, email_key or owner UUID is returned.
--   * Confirm retention/privacy review for state-level aggregates.
-- ============================================================================
