/**
 * EduPay Waitlist Admin API contract — runtime-safe copy of contract v3.
 *
 * Source: backend agent handoff 2026-11-09
 * (docs/BACKEND_INTEGRATION_CONTRACT.md, docs/waitlist-admin-api.d.ts).
 *
 * STATUS: routes are implemented LOCALLY in the backend repo (257 tests pass
 * with MOCKED Supabase queries), but NOT DEPLOYED. No cross-origin session
 * solution is approved. Live database behaviour is UNVERIFIED.
 *
 * See src/lib/api/client.ts -> BACKEND_READY for the single gate that must be
 * true before any network call is made. Nothing here is a live endpoint.
 */

export const WAITLIST_ADMIN_BASE_PATH = "/api/v1/admin/waitlist" as const;
export const WAITLIST_ADMIN_EXAMPLE_URL = "https://api.example.test/api/v1/admin/waitlist/registrations?page=1&pageSize=25&audience=student" as const;

export type WaitlistAudience = 'student' | 'parent_guardian' | 'institution';
export type WaitlistSignupStatus = 'pending_verification' | 'verified' | 'removed';
export type WaitlistAnalyticsPeriod = 'day' | 'week' | 'month';
export type WaitlistApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'FEATURE_UNAVAILABLE'
  | 'EXPORT_LIMIT_EXCEEDED';

export interface WaitlistApiError {
  statusCode: number;
  code: WaitlistApiErrorCode;
  message: string;
  correlationId: string;
  error?: string;
}

export interface WaitlistRegistrationSummary {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  audienceType: WaitlistAudience;
  state: string | null;
  schoolName: string | null;
  educationLevel: string | null;
  institutionName: string | null;
  institutionType: string | null;
  contactRole: string | null;
  status: WaitlistSignupStatus;
  waitlistConsent: true;
  waitlistNoticeVersion: string | null;
  waitlistConsentAt: string | null;
  marketingConsent: boolean;
  marketingConsentAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WaitlistOverviewResponse {
  total: number;
  verified: number;
  unverified: number;
  student: number;
  parentGuardian: number;
  institution: number;
  registrationGrowth: Array<{ date: string; registrations: number }>;
  audienceDistribution: Array<{ audienceType: WaitlistAudience; count: number }>;
  topStates: Array<{ state: string; count: number }>;
  recentRegistrations: WaitlistRegistrationSummary[];
  generatedAt: string;
}

export interface WaitlistRegistrationListRequest {
  q?: string;
  audience?: WaitlistAudience;
  status?: WaitlistSignupStatus;
  state?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface WaitlistRegistrationListResponse {
  items: WaitlistRegistrationSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface WaitlistRegistrationDetailRequest {
  id: string;
}

export interface WaitlistEmailActivitySummary {
  available: false;
  reason: string;
  verificationSentCount: number | null;
  lastVerificationSentAt: string | null;
}

export interface WaitlistRegistrationDetailResponse extends WaitlistRegistrationSummary {
  emailActivity: WaitlistEmailActivitySummary;
  consentHistory: {
    available: false;
    reason: string;
    currentStateOnly: true;
  };
}

export interface WaitlistAnalyticsRequest {
  period: WaitlistAnalyticsPeriod;
  from?: string;
  to?: string;
}

export interface WaitlistAnalyticsResponse {
  period: WaitlistAnalyticsPeriod;
  trend: Array<{ bucket: string; registrations: number; verified: number }>;
  audienceBreakdown: Array<{ audienceType: WaitlistAudience; count: number }>;
  verificationRate: number | null;
  marketingSubscriptionRate: number | null;
  stateDistribution: Array<{ state: string; count: number }>;
}

export interface WaitlistExportRequest {
  q?: string;
  audience?: WaitlistAudience;
  status?: WaitlistSignupStatus;
  state?: string;
  from?: string;
  to?: string;
}

export interface WaitlistSettingsResponse {
  ownerAccess: 'authenticated-owner-only';
  ownerUserIdReturned: false;
  senderConfiguration: 'configured' | 'not_configured';
  waitlistConfigurationKeys: string[];
  systemStatus: 'available' | 'degraded' | 'unavailable';
  emailActivityAvailable: false;
  campaignManagementAvailable: false;
  consentHistoryAvailable: false;
}

export interface WaitlistAuditListRequest {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  action?: string;
}

export interface WaitlistAuditEntry {
  id: string;
  actorType: 'staff' | 'system';
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface WaitlistAuditListResponse {
  items: WaitlistAuditEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface WaitlistFeatureUnavailableResponse {
  statusCode: 501;
  code: 'FEATURE_UNAVAILABLE';
  message: string;
  correlationId: string;
  error: string;
}
