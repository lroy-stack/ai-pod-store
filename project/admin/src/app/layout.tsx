import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { SSEProvider } from "@/components/providers/SSEProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotificationsProvider } from "@/contexts/NotificationsContext";

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
        <QueryProvider>
          <NotificationsProvider>
            <SSEProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </SSEProvider>
          </NotificationsProvider>
        </QueryProvider>
        <GlobalSearch />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
