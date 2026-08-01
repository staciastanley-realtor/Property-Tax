import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Michigan Property Tax Intelligence | Sold With Stacia",
  description:
    "A full property tax picture for any Michigan address — jurisdiction detection, homestead comparison, 5-year projection, and a statewide agent referral network.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
