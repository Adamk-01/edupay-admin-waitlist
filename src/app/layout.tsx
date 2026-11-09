import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "EduPay Waitlist Admin | Launch Control", description: "Private launch control for the EduPay waitlist." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
