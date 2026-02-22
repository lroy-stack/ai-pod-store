'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  DollarSign,
  Bot,
  Languages,
  FileText,
  Search,
  Star,
  RotateCcw,
  MessageSquare,
  Settings,
  Palette,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navigationSections: NavSection[] = [
  {
    label: 'Operations',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Products', href: '/products', icon: Package },
      { name: 'Orders', href: '/orders', icon: ShoppingCart },
      { name: 'Customers', href: '/customers', icon: Users },
      { name: 'Designs', href: '/designs', icon: Sparkles },
    ],
  },
  {
    label: 'Content',
    items: [
      { name: 'Branding', href: '/branding', icon: Palette },
      { name: 'Translations', href: '/translations', icon: Languages },
      { name: 'SEO', href: '/seo', icon: Search },
      { name: 'Reviews', href: '/reviews', icon: Star },
    ],
  },
  {
    label: 'AI & Agents',
    items: [
      { name: 'Agent Monitor', href: '/agent', icon: Bot },
      { name: 'Messaging', href: '/messaging', icon: MessageSquare },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { name: 'Analytics', href: '/analytics', icon: TrendingUp },
      { name: 'Finance', href: '/finance', icon: DollarSign },
    ],
  },
  {
    label: 'Settings',
    items: [
      { name: 'Audit Log', href: '/audit', icon: FileText },
      { name: 'Returns', href: '/returns', icon: RotateCcw },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold">POD AI</h1>
      </div>
      <ScrollArea className="h-[calc(100vh-4rem)]">
        <nav className="flex flex-col gap-4 p-4">
          {navigationSections.map((section, sectionIndex) => (
            <div key={section.label}>
              {sectionIndex > 0 && <Separator className="mb-4" />}
              <div className="mb-2">
                <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </h2>
                <div className="flex flex-col gap-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
