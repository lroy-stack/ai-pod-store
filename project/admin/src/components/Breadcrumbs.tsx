'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

// Map paths to human-readable names
const pathNameMap: Record<string, string> = {
  '': 'Dashboard',
  'products': 'Products',
  'orders': 'Orders',
  'customers': 'Customers',
  'analytics': 'Analytics',
  'finance': 'Finance',
  'agents': 'Agents',
  'translations': 'Translations',
  'audit': 'Audit Log',
  'seo': 'SEO',
  'reviews': 'Reviews',
  'returns': 'Returns',
  'messaging': 'Messaging',
  'settings': 'Settings',
};

export function Breadcrumbs() {
  const pathname = usePathname();

  // Split the pathname into segments
  const segments = pathname.split('/').filter(Boolean);

  // Build breadcrumb items
  const items: { name: string; href: string; icon?: typeof Home }[] = [
    { name: 'Admin', href: '/', icon: Home },
  ];

  let currentPath = '';
  segments.forEach((segment) => {
    currentPath += `/${segment}`;
    const name = pathNameMap[segment] || segment;

    items.push({
      name,
      href: currentPath,
    });
  });

  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
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
  );
}
