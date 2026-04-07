/**
 * Unified navigation items — single source of truth for Sidebar + MobileSidebar.
 *
 * Agent Chat is intentionally NOT here — it's accessible only from /panel/agent page.
 * It's an internal tool that will be protected with permissions in the future.
 */

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
  Ticket,
  FolderTree,
  Activity,
  Building2,
} from 'lucide-react';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
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
      { name: 'Pages & Heroes', href: '/content', icon: FileText },
      { name: 'Branding', href: '/branding', icon: Palette },
      { name: 'Translations', href: '/translations', icon: Languages },
      { name: 'SEO', href: '/seo', icon: Search },
      { name: 'Reviews', href: '/reviews', icon: Star },
      { name: 'Blog', href: '/blog', icon: FileText },
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
      { name: 'Coupons', href: '/coupons', icon: Ticket },
      { name: 'Analytics', href: '/analytics', icon: TrendingUp },
      { name: 'Finance', href: '/finance', icon: DollarSign },
    ],
  },
  {
    label: 'Settings',
    items: [
      { name: 'Categories', href: '/categories', icon: FolderTree },
      { name: 'Audit Log', href: '/audit', icon: FileText },
      { name: 'Legal Pages', href: '/legal', icon: FileText },
      { name: 'Returns', href: '/returns', icon: RotateCcw },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];
