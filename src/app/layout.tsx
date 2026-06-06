import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auric Axis - Equipment Sourcing",
  description:
    "Build the equipment universe a mine restart needs, then hunt the live market for every available used unit, nearest first.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
