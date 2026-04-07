'use client';

import { DashboardLayout } from '@/components/DashboardLayout';

/**
 * Dashboard route group layout
 *
 * Applies the shared DashboardLayout (sidebar, header, breadcrumbs) to all pages
 * in the (dashboard) route group without requiring manual imports.
 *
 * Route groups don't affect URL structure — /products still maps to /products,
 * but pages inside (dashboard) automatically inherit this layout.
 */
export default function DashboardRouteGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
