// Copyright (c) 2026 L.LÖWE <maintainer@example.com>
// SPDX-License-Identifier: MIT

import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { SSEProvider } from "@/components/providers/SSEProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { STORE_NAME } from "@/lib/store-defaults";

// Force all admin pages/routes to be dynamic (never pre-rendered at build time).
// Admin panel is behind auth — static pre-rendering makes no sense and causes
// build failures when env vars (SESSION_SECRET, SUPABASE_URL) are unavailable.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `${STORE_NAME} Admin`,
  description: `Admin panel for ${STORE_NAME} store management`,
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
