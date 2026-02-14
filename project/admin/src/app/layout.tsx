import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "POD AI Admin",
  description: "Admin panel for POD AI store management",
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
