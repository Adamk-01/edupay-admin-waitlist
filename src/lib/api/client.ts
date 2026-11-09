/**
 * SERVER-ONLY, gated API client for the Waitlist Admin contract (v3).
 *
 * Contract v3 status: the read endpoints ARE implemented in the backend repo
 * (docs/BACKEND_INTEGRATION_CONTRACT.md §D) with
 * `@UseGuards(AdminSessionGuard, WaitlistOwnerGuard)` in the correct order.
 * 257 tests pass — but with MOCKED Supabase queries. The owner's summary says
 * plainly: "implemented locally … nothing was committed, pushed, or deployed …
 * Live database behavior and cross-app regressions remain UNVERIFIED."
 *
 * Therefore BACKEND_READY is still FALSE and every method throws BEFORE any
 * network call. There is no deployed API to call and no approved cross-origin
 * session solution. No method returns fabricated data.
 *
 * This module must never be imported by a client component. The backend uses
 * HttpOnly cookies / bearer tokens and a custom CSRF header, so calls belong in
 * a Next.js server-side BFF route handler, not browser JavaScript.
 */

import {
  WAITLIST_ADMIN_BASE_PATH,
  type WaitlistAnalyticsRequest,
  type WaitlistAnalyticsResponse,
  type WaitlistApiErrorCode,
  type WaitlistApiError,
  type WaitlistAuditListRequest,
  type WaitlistAuditListResponse,
  type WaitlistExportRequest,
  type WaitlistOverviewResponse,
  type WaitlistRegistrationDetailRequest,
  type WaitlistRegistrationDetailResponse,
  type WaitlistRegistrationListRequest,
  type WaitlistRegistrationListResponse,
  type WaitlistSettingsResponse
} from "./contract";

/* ------------------------------------------------------------------ gates */

/** §D + §I: controller/service/spec exist; 24 suites / 257 tests pass locally. */
export const BACKEND_LOCAL_IMPLEMENTATION_VERIFIED = true;

/** Owner decision 2026-11-09: BFF authorization-code bridge. See docs/OWNER_DECISIONS.md. */
export const SESSION_APPROACH = "bff-authorization-code-bridge" as const;
export const SESSION_APPROACH_APPROVED = true;

/** Approval is NOT implementation: /auth/authorize and /auth/exchange do not exist yet. */
export const SESSION_BRIDGE_IMPLEMENTED = false;
/** Owner approved a STAGING deploy; it has not happened. No production deploy approved. */
export const BACKEND_DEPLOYED = false;
/** Contract §I: tests use MOCKED Supabase queries; live DB behaviour UNVERIFIED. */
export const LIVE_DB_VERIFIED = false;

/**
 * The single gate. Approval, implementation, deployment and live verification
 * are four separate facts — all four must be true before any network call.
 * Do not set this from an env flag alone.
 */
export const BACKEND_READY =
  BACKEND_LOCAL_IMPLEMENTATION_VERIFIED &&
  SESSION_BRIDGE_IMPLEMENTED &&
  BACKEND_DEPLOYED &&
  LIVE_DB_VERIFIED;

export function backendReadiness(): string {
  const closed: string[] = [];
  if (!BACKEND_LOCAL_IMPLEMENTATION_VERIFIED) closed.push("endpoints not implemented");
  if (!SESSION_BRIDGE_IMPLEMENTED) closed.push("BFF bridge endpoints not implemented");
  if (!BACKEND_DEPLOYED) closed.push("backend not deployed to staging");
  if (!LIVE_DB_VERIFIED) closed.push("live database not verified");
  return closed.length ? closed.join("; ") : "ready";
}

/* ------------------------------------------------------------------ errors */

export class WaitlistApiUnavailableError extends Error {
  readonly name = "WaitlistApiUnavailableError";
  readonly code = "FEATURE_UNAVAILABLE" as const;
  constructor(readonly feature: string, readonly blocker: string = backendReadiness()) {
    super(`${feature} is unavailable: ${blocker}.`);
  }
}

/** Contract §D: /email-activity and /campaigns return 501 by design. */
export class WaitlistFeatureUnavailableError extends Error {
  readonly name = "WaitlistFeatureUnavailableError";
  readonly code = "FEATURE_UNAVAILABLE" as const;
  constructor(readonly feature: string, readonly reason: string, readonly correlationId: string) {
    super(`${feature} is not supported by the backend: ${reason}`);
  }
}

export class WaitlistApiValidationError extends Error {
  readonly name = "WaitlistApiValidationError";
  constructor(message: string) {
    super(message);
  }
}

export class WaitlistApiHttpError extends Error {
  readonly name = "WaitlistApiHttpError";
  constructor(
    readonly status: number,
    readonly code: WaitlistApiErrorCode,
    message: string,
    readonly correlationId: string
  ) {
    super(message);
  }
}

export function assertBackendReady(feature: string): void {
  if (typeof window !== "undefined") {
    throw new Error("The Waitlist Admin API client is server-only. Call it from a BFF route handler.");
  }
  if (!BACKEND_READY) throw new WaitlistApiUnavailableError(feature);
}

/* -------------------------------------------------------------- validation */

const COMMON_KEYS = ["q", "audience", "status", "state", "from", "to"] as const;
const LIST_KEYS = [...COMMON_KEYS, "page", "pageSize"] as const;
/** Contract §F: pagination keys are NOT accepted for export. */
const EXPORT_KEYS = COMMON_KEYS;

const AUDIENCES = ["student", "parent_guardian", "institution"] as const;
const STATUSES = ["pending_verification", "verified", "removed"] as const;
const PERIODS = ["day", "week", "month"] as const;

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function buildQuery(
  input: object,
  allowed: readonly string[],
  withPagination: boolean
): string {
  const record = input as Record<string, unknown>;
  const unknown = Object.keys(record).filter(
    (key) => record[key] !== undefined && !allowed.includes(key)
  );
  if (unknown.length) throw new WaitlistApiValidationError(`Unknown filter(s): ${unknown.join(", ")}`);

  const params = new URLSearchParams();
  const { q, audience, status, state, from, to } = record;

  if (q !== undefined) {
    if (typeof q !== "string" || q.length < 1 || q.length > 100) throw new WaitlistApiValidationError("q must be 1–100 characters");
    params.set("q", q);
  }
  if (audience !== undefined) {
    if (typeof audience !== "string" || !AUDIENCES.includes(audience as (typeof AUDIENCES)[number])) throw new WaitlistApiValidationError("Invalid audience");
    params.set("audience", audience as string);
  }
  if (status !== undefined) {
    if (typeof status !== "string" || !STATUSES.includes(status as (typeof STATUSES)[number])) throw new WaitlistApiValidationError("Invalid status");
    params.set("status", status as string);
  }
  if (state !== undefined) {
    if (typeof state !== "string" || state.length < 1 || state.length > 120) throw new WaitlistApiValidationError("state must be 1–120 characters");
    params.set("state", state as string);
  }
  if (from !== undefined) {
    if (typeof from !== "string" || !isIsoDate(from)) throw new WaitlistApiValidationError("from must be an ISO date");
    params.set("from", from);
  }
  if (to !== undefined) {
    if (typeof to !== "string" || !isIsoDate(to)) throw new WaitlistApiValidationError("to must be an ISO date");
    params.set("to", to);
  }
  if (typeof from === "string" && typeof to === "string" && Date.parse(from) > Date.parse(to)) {
    throw new WaitlistApiValidationError("from must not be after to");
  }

  if (withPagination) {
    const page = (record.page as number | undefined) ?? 1;
    const pageSize = (record.pageSize as number | undefined) ?? 25;
    if (!Number.isInteger(page) || (page as number) < 1) throw new WaitlistApiValidationError("page must be an integer >= 1");
    if (!Number.isInteger(pageSize) || (pageSize as number) < 1 || (pageSize as number) > 100) throw new WaitlistApiValidationError("pageSize must be 1–100");
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
  }
  return params.toString();
}

export function buildRegistrationQuery(input: WaitlistRegistrationListRequest): string {
  return buildQuery(input, LIST_KEYS, true);
}

/** No page/pageSize — the backend rejects them on export (contract §F). */
export function buildExportQuery(input: WaitlistExportRequest): string {
  return buildQuery(input, EXPORT_KEYS, false);
}

export function buildAnalyticsQuery(input: WaitlistAnalyticsRequest): string {
  if (!PERIODS.includes(input.period)) throw new WaitlistApiValidationError("period must be day, week or month");
  const params = new URLSearchParams({ period: input.period });
  if (input.from !== undefined) {
    if (!isIsoDate(input.from)) throw new WaitlistApiValidationError("from must be an ISO date");
    params.set("from", input.from);
  }
  if (input.to !== undefined) {
    if (!isIsoDate(input.to)) throw new WaitlistApiValidationError("to must be an ISO date");
    params.set("to", input.to);
  }
  if (input.from && input.to) {
    const days = (Date.parse(input.to) - Date.parse(input.from)) / 86_400_000;
    if (days < 0) throw new WaitlistApiValidationError("from must not be after to");
    if (days > 366) throw new WaitlistApiValidationError("analytics range must not exceed 366 days");
  }
  return params.toString();
}

export function buildAuditQuery(input: WaitlistAuditListRequest): string {
  const allowed = ["page", "pageSize", "from", "to", "action"] as const;
  const record = input as Record<string, unknown>;
  const unknown = Object.keys(record).filter((k) => record[k] !== undefined && !allowed.includes(k as (typeof allowed)[number]));
  if (unknown.length) throw new WaitlistApiValidationError(`Unknown filter(s): ${unknown.join(", ")}`);
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 25;
  if (!Number.isInteger(page) || page < 1) throw new WaitlistApiValidationError("page must be an integer >= 1");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new WaitlistApiValidationError("pageSize must be 1–100");
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (input.from !== undefined) {
    if (!isIsoDate(input.from)) throw new WaitlistApiValidationError("from must be an ISO date");
    params.set("from", input.from);
  }
  if (input.to !== undefined) {
    if (!isIsoDate(input.to)) throw new WaitlistApiValidationError("to must be an ISO date");
    params.set("to", input.to);
  }
  if (input.action !== undefined) {
    if (!input.action.startsWith("waitlist.") || input.action.length > 120) throw new WaitlistApiValidationError("action must start with waitlist. and be <= 120 chars");
    params.set("action", input.action);
  }
  if (input.from && input.to && Date.parse(input.from) > Date.parse(input.to)) throw new WaitlistApiValidationError("from must not be after to");
  return params.toString();
}

/* ------------------------------------------------------------------ request */

export interface WaitlistAdminClientOptions {
  /** Server-only backend origin, e.g. from EDUPAY_API_BASE_URL. Never a secret. */
  baseUrl: string;
  /** Session headers supplied by the BFF route handler, never by the browser. */
  headers: Record<string, string>;
  /** Exact allowlisted Origin required by export's audit write (contract §D). */
  origin?: string;
  fetchImpl?: typeof fetch;
  /** Bounded extra attempts on 429/5xx. Default 2. */
  retries?: number;
  signal?: AbortSignal;
}

function urlFor(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${WAITLIST_ADMIN_BASE_PATH}${path}`;
}

async function parseError(response: Response): Promise<WaitlistApiHttpError> {
  let envelope: Partial<WaitlistApiError> = {};
  try { envelope = (await response.json()) as Partial<WaitlistApiError>; } catch { /* use fallback */ }
  const code = envelope.code ?? "INTERNAL_ERROR";
  const message = envelope.message ?? `Request failed with status ${response.status}`;
  const correlationId = envelope.correlationId ?? "";
  if (response.status === 501 && code === "FEATURE_UNAVAILABLE") {
    // Caller maps this to a feature-specific unavailable error.
    return Object.assign(
      new WaitlistApiHttpError(501, code, message, correlationId),
      { featureReason: envelope.error ?? message }
    );
  }
  return new WaitlistApiHttpError(response.status, code, message, correlationId);
}

async function requestJson<T>(path: string, options: WaitlistAdminClientOptions, signal?: AbortSignal): Promise<T> {
  const doFetch = options.fetchImpl ?? fetch;
  const retries = Math.min(Math.max(options.retries ?? 2, 0), 3);
  const effectiveSignal = signal ?? options.signal;
  const url = urlFor(options.baseUrl, path);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (effectiveSignal?.aborted) throw new Error("Request aborted");
    let response: Response;
    try {
      response = await doFetch(url, {
        method: "GET",
        headers: { Accept: "application/json", ...options.headers },
        cache: "no-store",
        signal: effectiveSignal
      });
    } catch (error) {
      if (attempt === retries) throw error;
      continue;
    }

    if ((response.status === 429 || response.status >= 500) && response.status !== 501 && attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
      continue;
    }
    if (!response.ok) throw await parseError(response);
    return (await response.json()) as T;
  }
  throw new Error("Unreachable");
}

async function requestFeatureUnavailable(
  feature: string,
  path: string,
  options: WaitlistAdminClientOptions,
  signal?: AbortSignal
): Promise<never> {
  try {
    await requestJson<never>(path, { ...options, retries: 0 }, signal);
  } catch (error) {
    if (error instanceof WaitlistApiHttpError && error.status === 501) {
      const reason = (error as WaitlistApiHttpError & { featureReason?: string }).featureReason ?? error.message;
      throw new WaitlistFeatureUnavailableError(feature, reason, error.correlationId);
    }
    throw error;
  }
  // A 2xx here would contradict the contract; fail closed rather than fabricate.
  throw new WaitlistFeatureUnavailableError(feature, "contract violation: expected 501", "");
}

/* ------------------------------------------------------------------- client */

export function createWaitlistAdminClient(options: WaitlistAdminClientOptions) {
  return {
    getOverview(signal?: AbortSignal): Promise<WaitlistOverviewResponse> {
      assertBackendReady("Overview");
      return requestJson<WaitlistOverviewResponse>("/overview", options, signal);
    },
    listRegistrations(input: WaitlistRegistrationListRequest, signal?: AbortSignal): Promise<WaitlistRegistrationListResponse> {
      assertBackendReady("Registrations");
      return requestJson<WaitlistRegistrationListResponse>(`/registrations?${buildRegistrationQuery(input)}`, options, signal);
    },
    getRegistration(input: WaitlistRegistrationDetailRequest, signal?: AbortSignal): Promise<WaitlistRegistrationDetailResponse> {
      assertBackendReady("Registration detail");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id)) {
        throw new WaitlistApiValidationError("id must be a UUID");
      }
      return requestJson<WaitlistRegistrationDetailResponse>(`/registrations/${encodeURIComponent(input.id)}`, options, signal);
    },
    getAnalytics(input: WaitlistAnalyticsRequest, signal?: AbortSignal): Promise<WaitlistAnalyticsResponse> {
      assertBackendReady("Analytics");
      return requestJson<WaitlistAnalyticsResponse>(`/analytics?${buildAnalyticsQuery(input)}`, options, signal);
    },
    /** CSV is a raw response; the backend writes the waitlist.exported audit row before returning it. */
    exportCsv(input: WaitlistExportRequest, signal?: AbortSignal): Promise<Response> {
      // Deliberately NOT async: the closed gate must fail synchronously, like
      // every other method, before any fetch is even constructed.
      assertBackendReady("CSV export");
      if (!options.origin) throw new WaitlistApiValidationError("export requires an exact allowlisted Origin");
      const query = buildExportQuery(input);
      const doFetch = options.fetchImpl ?? fetch;
      return doFetch(
        urlFor(options.baseUrl, `/registrations/export.csv?${query}`),
        {
          method: "GET",
          headers: {
            ...options.headers,
            "X-Requested-With": "edupay-admin",
            Origin: options.origin,
            Accept: "text/csv"
          },
          cache: "no-store",
          signal: signal ?? options.signal
        }
      ).then(async (response) => {
        if (!response.ok) throw await parseError(response);
        return response;
      });
    },
    getSettings(signal?: AbortSignal): Promise<WaitlistSettingsResponse> {
      assertBackendReady("Settings");
      return requestJson<WaitlistSettingsResponse>("/settings", options, signal);
    },
    getAuditLogs(input: WaitlistAuditListRequest, signal?: AbortSignal): Promise<WaitlistAuditListResponse> {
      assertBackendReady("Audit logs");
      return requestJson<WaitlistAuditListResponse>(`/audit-logs?${buildAuditQuery(input)}`, options, signal);
    },
    /** Contract §D: 501 FEATURE_UNAVAILABLE until a durable event source exists. */
    getEmailActivity(signal?: AbortSignal): Promise<never> {
      assertBackendReady("Email activity");
      return requestFeatureUnavailable("Email activity", "/email-activity", options, signal);
    },
    /** Contract §D: 501 FEATURE_UNAVAILABLE until campaign schema/service exists. */
    getCampaigns(signal?: AbortSignal): Promise<never> {
      assertBackendReady("Campaigns");
      return requestFeatureUnavailable("Campaigns", "/campaigns", options, signal);
    }
  };
}
