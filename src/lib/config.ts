/**
 * Build-time configuration for the standalone Waitlist Admin app.
 *
 * Only NON-SECRET values may live here. `NEXT_PUBLIC_*` values are inlined into
 * the browser bundle at build time, so an owner UUID, session secret, service
 * role key or mail provider credential must never be added to this file.
 */

export type DataMode = "demo" | "live";

/**
 * Phase 4/5 seam. Until the owner-protected backend API is verified and wired,
 * `demo` keeps the clearly labelled sample UI, while `live` deliberately shows
 * an honest "not connected" state rather than fabricated production figures.
 */
export const DATA_MODE: DataMode =
  process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "demo";

export const IS_DEMO = DATA_MODE === "demo";

/** Public origin of this app; used only for metadata. May be unset locally. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || null;

/**
 * Whether a verified backend contract is available. Kept as an explicit,
 * single source of truth so no page can accidentally imply a live connection
 * before Phase 5 is complete.
 */
export const BACKEND_CONNECTED = false;
