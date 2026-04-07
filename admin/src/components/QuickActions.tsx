'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ShoppingCart, Bot, BarChart3 } from 'lucide-react';

interface QuickAction {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  iconColor: string;
}

export function QuickActions() {
  const router = useRouter();

  const actions: QuickAction[] = [
    {
      icon: <Package className="h-6 w-6" />,
      title: 'Create Product',
      description: 'Add a new product to the catalog',
      href: '/products/new',
      iconColor: 'text-primary',
    },
    {
      icon: <ShoppingCart className="h-6 w-6" />,
      title: 'Pending Orders',
      description: 'View orders awaiting fulfillment',
      href: '/orders?status=pending',
      iconColor: 'text-warning',
    },
    {
      icon: <Bot className="h-6 w-6" />,
      title: 'Run Agent',
      description: 'Start PodClaw autonomous agent',
      href: '/agent',
      iconColor: 'text-primary',
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: 'View Reports',
      description: 'Analytics and business insights',
      href: '/analytics',
      iconColor: 'text-success',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {actions.map((action) => (
        <Card
          key={action.title}
          className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
          onClick={() => router.push(action.href)}
        >
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className={`${action.iconColor}`}>{action.icon}</div>
            <div className="flex-1">
              <CardTitle className="text-base">{action.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>{action.description}</CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
