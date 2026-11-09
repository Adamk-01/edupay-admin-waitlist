import type { NextConfig } from "next";

/**
 * Security headers for an internal admin application.
 *
 * `connect-src 'self'` is intentional: until the owner-protected backend API is
 * verified, this app must not make browser-side calls to any third-party host.
 * When a same-site backend proxy is introduced, extend `connect-src` to that
 * single origin rather than using a wildcard.
 *
 * `script-src 'unsafe-inline'` is required by Next.js' inline bootstrap/RSC
 * payloads. It is acceptable here only because this app renders no
 * visitor-controlled HTML (no dangerouslySetInnerHTML). A nonce-based CSP is
 * the stronger option once the app renders server-side data.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data:",
  "connect-src 'self'",
  "upgrade-insecure-requests"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // `preload` is omitted deliberately: it is a near-permanent, subdomain-wide
  // commitment. Add it only once HTTPS is confirmed on every planned origin.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" }
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};

export default nextConfig;
