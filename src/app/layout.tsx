import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auric Iron Matrix",
  description:
    "Heavy equipment valuation engine for oil and gas and mining distressed-asset work.",
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
