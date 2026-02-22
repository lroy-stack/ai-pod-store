import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { SSEProvider } from "@/components/providers/SSEProvider";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
      <body>
        <SSEProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </SSEProvider>
        <GlobalSearch />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
