import type { Metadata } from "next";
import { SITE_URL } from "@/lib/config";
import "./globals.css";
import "./admin.css";

export const metadata: Metadata = {
  title: "EduPay Waitlist Admin | Launch Control",
  description: "Private launch control for the EduPay waitlist.",
  // Internal admin tool: it must not be indexed, even while it is a demo.
  // Deployment-level access control is still required in addition to this.
  robots: { index: false, follow: false, nocache: true },
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {})
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
