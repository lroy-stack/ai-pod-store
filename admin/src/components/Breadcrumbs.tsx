'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, Home, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

// UUID pattern for dynamic route segments
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Map paths to human-readable names
const pathNameMap: Record<string, string> = {
  '': 'Dashboard',
  'products': 'Products',
  'orders': 'Orders',
  'customers': 'Customers',
  'analytics': 'Analytics',
  'finance': 'Finance',
  'agents': 'Agents',
  'agent': 'Agent',
  'translations': 'Translations',
  'audit': 'Audit Log',
  'seo': 'SEO',
  'reviews': 'Reviews',
  'returns': 'Returns',
  'messaging': 'Messaging',
  'settings': 'Settings',
  'branding': 'Branding',
  'designs': 'Designs',
  'ab-tests': 'A/B Tests',
  'monitoring': 'Monitoring',
  'metrics': 'Metrics',
  'memory': 'Memory',
  'soul': 'Soul',
  'schedule': 'Schedule',
  'health': 'Health',
  'chat': 'Chat',
  'errors': 'Errors',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const router = useRouter();

  // Split the pathname into segments
  const segments = pathname.split('/').filter(Boolean);

  // Build breadcrumb items
  const items: { name: string; href: string; icon?: typeof Home }[] = [
    { name: 'Dashboard', href: '/', icon: Home },
  ];

  let currentPath = '';
  segments.forEach((segment) => {
    currentPath += `/${segment}`;
    const name = pathNameMap[segment] || (UUID_REGEX.test(segment) ? `${segment.slice(0, 8)}...` : segment);

    items.push({
      name,
      href: currentPath,
    });
  });

  // Get parent page for mobile back button
  const parentHref = items.length > 1 ? items[items.length - 2].href : '/';

  const handleBack = () => {
    router.push(parentHref);
  };

  return (
    <>
      {/* Mobile: Back button only */}
      <nav className="md:hidden mb-4">
        {items.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-2 -ml-2 text-muted-foreground hover:text-foreground min-h-[44px] px-3 py-3"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
        )}
      </nav>

      {/* Desktop: Full breadcrumb trail */}
      <nav className="hidden md:flex items-center gap-2 text-sm text-muted-foreground mb-4">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const Icon = item.icon;

          return (
            <div key={item.href} className="flex items-center gap-2">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
              )}
              {isLast ? (
                <span className="font-medium text-foreground flex items-center gap-1">
                  {Icon && <Icon className="h-4 w-4" />}
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors flex items-center gap-1"
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {item.name}
                </Link>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );
}
