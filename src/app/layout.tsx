import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "McCord Investments - Time to Power",
  description:
    "Power for Canadian builds, sourced globally and placed in Canada, faster than the grid queue. Tell us what you are building.",
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
