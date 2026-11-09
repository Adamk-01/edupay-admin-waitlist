/**
 * Honest feature-availability map, derived from contract v3 (2026-11-09).
 *
 * v3 change: the backend agent IMPLEMENTED the read endpoints locally with
 * AdminSessionGuard → WaitlistOwnerGuard and 257 passing (mocked) tests. But
 * the contract status is "implemented locally, not deployed"; both session
 * options remain PROPOSAL — NOT IMPLEMENTED; live DB behaviour is UNVERIFIED.
 *
 * `callable: false` therefore stays false everywhere. No page may claim live
 * data. See src/lib/api/client.ts -> BACKEND_READY for the single gate.
 */

/** Owner decisions 2026-11-09 — approvals, NOT implementation. See docs/OWNER_DECISIONS.md. */
export const OWNER_DECISIONS = {
  sessionApproach: "BFF authorization-code bridge",
  sessionApproved: true,
  sessionImplemented: false,
  stagingDeployApproved: true,
  stagingDeployed: false,
  schemaDeferred: true,
  productionDeployApproved: false
} as const;

export type FeatureKey =
  | "overview"
  | "registrations"
  | "analytics"
  | "campaigns"
  | "emailActivity"
  | "exports"
  | "settings"
  | "consentHistory";

export type EndpointState =
  /** Implemented in the backend repo, correct guards, but NOT deployed. */
  | "implemented-locally"
  /** Backend intentionally returns 501 FEATURE_UNAVAILABLE. */
  | "unavailable-by-design"
  /** No route at all (needs schema work first). */
  | "not-implemented";

export interface FeatureStatus {
  /** Real records exist that could support this feature. */
  dataSupported: boolean;
  endpointState: EndpointState;
  /** The contract says "not deployed"; live DB queries were NOT run. */
  deployedVerified: false;
  /** No network call may be made yet. */
  callable: false;
  reason: string;
  requires: string[];
}

const LOCAL_ONLY =
  "Contract v3 §D: this route is implemented locally in the backend repo with " +
  "AdminSessionGuard → WaitlistOwnerGuard and 257 passing tests, but its status " +
  "is 'implemented locally, not deployed'. Tests use MOCKED Supabase queries; " +
  "live database behaviour and cross-app regressions are UNVERIFIED.";

const NO_SESSION =
  "Neither cross-origin session option is approved: the authorization-code BFF " +
  "bridge and the same-site alias are both PROPOSAL — NOT IMPLEMENTED. Cookie " +
  "flags, CORS allowlists and DNS must not be weakened or changed without owner approval.";

export const FEATURE_STATUS: Record<FeatureKey, FeatureStatus> = {
  overview: {
    dataSupported: true,
    endpointState: "implemented-locally",
    deployedVerified: false,
    callable: false,
    reason: `${LOCAL_ONLY} Exact PostgREST HEAD counts supply totals, 30 daily buckets and top-10 state buckets; no rows are materialised in Node. ${NO_SESSION}`,
    requires: ["Owner approval to deploy the backend endpoints", "Verify a real service-role query against the live DB", "Approve a cross-origin session solution", "Then enable BACKEND_READY and add BFF route handlers"]
  },
  registrations: {
    dataSupported: true,
    endpointState: "implemented-locally",
    deployedVerified: false,
    callable: false,
    reason: `${LOCAL_ONLY} Filtered list, range pagination, exact count and UUID detail use an explicit select allowlist excluding email_key, token_hash and raw tokens. ${NO_SESSION}`,
    requires: ["Owner approval to deploy the backend endpoints", "Verify real query results / pagination on live data", "Approve a cross-origin session solution", "Then enable BACKEND_READY and add BFF route handlers"]
  },
  analytics: {
    dataSupported: true,
    endpointState: "implemented-locally",
    deployedVerified: false,
    callable: false,
    reason: `${LOCAL_ONLY} Bounded exact counts per period bucket (max 366 days, concurrency 8). Rates are null when the denominator is zero — correctly, rather than invented. ${NO_SESSION}`,
    requires: ["Owner approval to deploy the backend endpoints", "Verify real aggregates on live data", "Approve a cross-origin session solution", "Then enable BACKEND_READY and add BFF route handlers"]
  },
  campaigns: {
    dataSupported: false,
    endpointState: "unavailable-by-design",
    deployedVerified: false,
    callable: false,
    reason: "Contract v3 §D: GET /campaigns returns 501 FEATURE_UNAVAILABLE because no campaign, recipient, queue, idempotency, sending or provider-event schema exists. The §H DDL is PROPOSAL ONLY — NOT EXECUTED. No campaign data is fabricated.",
    requires: ["Owner permission for new schema / migration", "Campaign + recipient + event tables", "Provider webhook ingestion with signature verification", "Unsubscribe suppression and explicit send confirmation", "Owner-only create/test/send endpoints"]
  },
  emailActivity: {
    dataSupported: false,
    endpointState: "unavailable-by-design",
    deployedVerified: false,
    callable: false,
    reason: "Contract v3 §D: GET /email-activity returns 501 FEATURE_UNAVAILABLE. No delivery, bounce, failed, open, click, unsubscribe or per-attempt resend event log exists. verification_sent_count / last_verification_sent_at are counters, not evidence of delivery.",
    requires: ["Durable email-event table", "Provider webhook ingestion with signature verification", "Unsubscribe ledger", "Owner-only read endpoint"]
  },
  exports: {
    dataSupported: true,
    endpointState: "implemented-locally",
    deployedVerified: false,
    callable: false,
    reason: `${LOCAL_ONLY} Audited CSV with a 5,000-row hard cap, formula-injection escaping, no pagination keys, and a waitlist.exported audit_logs entry carrying only filter names and row count. ${NO_SESSION}`,
    requires: ["Owner approval to deploy the backend endpoints", "Verify CSV accuracy and audit row on live data", "Approve a cross-origin session solution", "Then enable BACKEND_READY and add BFF route handlers"]
  },
  settings: {
    dataSupported: true,
    endpointState: "implemented-locally",
    deployedVerified: false,
    callable: false,
    reason: `${LOCAL_ONLY} Reports only owner-access status, configured/not_configured sender state, key names and system status. It never returns the owner UUID or configuration values. ${NO_SESSION}`,
    requires: ["Owner approval to deploy the backend endpoints", "Verify the zero-row HEAD probe on the live DB", "Approve a cross-origin session solution", "Then enable BACKEND_READY and add BFF route handlers"]
  },
  consentHistory: {
    dataSupported: false,
    endpointState: "not-implemented",
    deployedVerified: false,
    callable: false,
    reason: "Only current consent booleans, notice version and two timestamps are stored; there is no consent event history. Registration detail honestly reports current-state-only. The §H consent-events DDL is PROPOSAL ONLY — NOT EXECUTED.",
    requires: ["Owner permission for a consent-events table", "Backfill / migration design", "Owner-only read endpoint"]
  }
};

export interface AdminSection {
  slug: string;
  label: string;
  heading: string;
  summary: string;
  feature: FeatureKey;
}

/** Real routes for the requested pages. All currently render honest states. */
export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { slug: "registrations", label: "Registrations", heading: "Registrations", summary: "Search, filter and inspect waitlist registrations.", feature: "registrations" },
  { slug: "analytics", label: "Analytics", heading: "Analytics", summary: "Trends, audience, verification and state distribution.", feature: "analytics" },
  { slug: "campaigns", label: "Launch campaigns", heading: "Launch campaigns", summary: "Create, preview, test and send waitlist campaigns.", feature: "campaigns" },
  { slug: "email-activity", label: "Email activity", heading: "Email activity", summary: "Verification and campaign delivery outcomes.", feature: "emailActivity" },
  { slug: "exports", label: "Exports", heading: "Exports", summary: "Authorised CSV exports of eligible registrations.", feature: "exports" },
  { slug: "settings", label: "Settings", heading: "Settings", summary: "Owner access, sender status, configuration and audit log.", feature: "settings" }
] as const;

export const ENDPOINT_STATE_LABEL: Record<EndpointState, string> = {
  "implemented-locally": "Implemented locally · NOT DEPLOYED",
  "unavailable-by-design": "Backend returns 501 · no data source",
  "not-implemented": "No endpoint yet"
};

export function findSection(slug: string): AdminSection | undefined {
  return ADMIN_SECTIONS.find((section) => section.slug === slug);
}
