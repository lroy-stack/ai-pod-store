'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-api';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
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
  Plus,
  FileEdit,
} from 'lucide-react';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
}

interface ActionItem {
  name: string;
  action: () => void;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
}

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: 'product' | 'order' | 'customer';
  url: string;
  meta: string;
}

interface SearchResults {
  products: SearchResult[];
  orders: SearchResult[];
  customers: SearchResult[];
}

const navigationItems: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    keywords: ['home', 'overview', 'dashboard'],
  },
  {
    name: 'Products',
    href: '/products',
    icon: Package,
    keywords: ['products', 'catalog', 'items', 'merchandise'],
  },
  {
    name: 'Orders',
    href: '/orders',
    icon: ShoppingCart,
    keywords: ['orders', 'purchases', 'transactions', 'sales'],
  },
  {
    name: 'Customers',
    href: '/customers',
    icon: Users,
    keywords: ['customers', 'users', 'clients', 'people'],
  },
  {
    name: 'Designs',
    href: '/designs',
    icon: Sparkles,
    keywords: ['designs', 'artwork', 'graphics', 'images'],
  },
  {
    name: 'Branding',
    href: '/branding',
    icon: Palette,
    keywords: ['branding', 'themes', 'colors', 'styling'],
  },
  {
    name: 'Translations',
    href: '/translations',
    icon: Languages,
    keywords: ['translations', 'i18n', 'languages', 'locales'],
  },
  {
    name: 'SEO',
    href: '/seo',
    icon: Search,
    keywords: ['seo', 'search', 'optimization', 'metadata'],
  },
  {
    name: 'Reviews',
    href: '/reviews',
    icon: Star,
    keywords: ['reviews', 'ratings', 'feedback', 'testimonials'],
  },
  {
    name: 'Agent Monitor',
    href: '/agent',
    icon: Bot,
    keywords: ['agent', 'podclaw', 'ai', 'bot', 'automation'],
  },
  {
    name: 'Messaging',
    href: '/messaging',
    icon: MessageSquare,
    keywords: ['messaging', 'chat', 'messages', 'conversations'],
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: TrendingUp,
    keywords: ['analytics', 'stats', 'metrics', 'reports'],
  },
  {
    name: 'Finance',
    href: '/finance',
    icon: DollarSign,
    keywords: ['finance', 'money', 'revenue', 'payments'],
  },
  {
    name: 'Audit Log',
    href: '/audit',
    icon: FileText,
    keywords: ['audit', 'log', 'history', 'activity'],
  },
  {
    name: 'Returns',
    href: '/returns',
    icon: RotateCcw,
    keywords: ['returns', 'refunds', 'exchanges'],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    keywords: ['settings', 'preferences', 'config', 'configuration'],
  },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults>({
    products: [],
    orders: [],
    customers: [],
  });
  const [searchLoading, setSearchLoading] = useState(false);
  const router = useRouter();

  // Define actions
  const actions: ActionItem[] = [
    {
      name: 'Create Product',
      action: () => {
        setOpen(false);
        router.push('/products/new');
      },
      icon: Plus,
      keywords: ['create', 'new', 'add', 'product'],
    },
    {
      name: 'Create Order',
      action: () => {
        setOpen(false);
        router.push('/orders/new');
      },
      icon: Plus,
      keywords: ['create', 'new', 'add', 'order'],
    },
    {
      name: 'Edit Theme',
      action: () => {
        setOpen(false);
        router.push('/branding');
      },
      icon: FileEdit,
      keywords: ['edit', 'theme', 'branding', 'customize'],
    },
  ];

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Debounced search for data (products, orders, customers)
  useEffect(() => {
    if (search.trim().length === 0) {
      setSearchResults({ products: [], orders: [], customers: [] });
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await adminFetch(`/api/search?q=${encodeURIComponent(search)}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.results || { products: [], orders: [], customers: [] });
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [search]);

  const handleSelect = useCallback((callback: () => void) => {
    setOpen(false);
    setSearch('');
    callback();
  }, []);

  const handleSearchResultSelect = useCallback(
    (url: string) => {
      setOpen(false);
      setSearch('');
      router.push(url);
    },
    [router]
  );

  const getSearchIcon = (type: string) => {
    switch (type) {
      case 'product':
        return <Package className="h-4 w-4 mr-2" />;
      case 'order':
        return <ShoppingCart className="h-4 w-4 mr-2" />;
      case 'customer':
        return <Users className="h-4 w-4 mr-2" />;
      default:
        return null;
    }
  };

  // Check if there are search results
  const hasSearchResults =
    searchResults.products.length > 0 ||
    searchResults.orders.length > 0 ||
    searchResults.customers.length > 0;

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Type a command or search..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          {searchLoading && search.trim().length >= 3 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          )}

          <CommandEmpty>
            {search.trim() ? (
              <div className="py-6 text-center text-sm">
                <p className="mb-2 text-muted-foreground">No results found.</p>
                <button
                  onClick={() => {
                    setOpen(false);
                    setSearch('');
                    router.push('/agent');
                  }}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Bot className="h-4 w-4" />
                  Ask PodClaw: "{search}"
                </button>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Start typing to search...
              </p>
            )}
          </CommandEmpty>

          {/* Always show navigation and actions (cmdk will filter them) */}
          <CommandGroup heading="Navigation">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.href}
                  value={item.name}
                  keywords={item.keywords}
                  onSelect={() => handleSelect(() => router.push(item.href))}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{item.name}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Actions">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <CommandItem
                  key={action.name}
                  value={action.name}
                  keywords={action.keywords}
                  onSelect={() => handleSelect(action.action)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{action.name}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="AI Assistant">
            <CommandItem
              value="Ask PodClaw"
              keywords={['podclaw', 'ai', 'agent', 'ask', 'help']}
              onSelect={() => handleSelect(() => router.push('/agent'))}
            >
              <Bot className="mr-2 h-4 w-4" />
              <span>Ask PodClaw</span>
            </CommandItem>
          </CommandGroup>

          {/* Show search results when search length >= 3 */}
          {search.trim().length >= 3 && !searchLoading && hasSearchResults && (
            <>
              <CommandSeparator />

              {searchResults.products.length > 0 && (
                <CommandGroup heading="Products (Search Results)">
                  {searchResults.products.map((result) => (
                    <CommandItem
                      key={result.id}
                      value={`product-${result.id}`}
                      onSelect={() => handleSearchResultSelect(result.url)}
                    >
                      {getSearchIcon(result.type)}
                      <div className="flex-1">
                        <div className="font-medium">{result.title}</div>
                        {result.subtitle && (
                          <div className="text-sm text-muted-foreground">
                            {result.subtitle}
                          </div>
                        )}
                      </div>
                      {result.meta && (
                        <div className="text-sm text-muted-foreground">{result.meta}</div>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {searchResults.customers.length > 0 && (
                <CommandGroup heading="Customers (Search Results)">
                  {searchResults.customers.map((result) => (
                    <CommandItem
                      key={result.id}
                      value={`customer-${result.id}`}
                      onSelect={() => handleSearchResultSelect(result.url)}
                    >
                      {getSearchIcon(result.type)}
                      <div className="flex-1">
                        <div className="font-medium">{result.title}</div>
                        {result.subtitle && (
                          <div className="text-sm text-muted-foreground">
                            {result.subtitle}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {searchResults.orders.length > 0 && (
                <CommandGroup heading="Orders (Search Results)">
                  {searchResults.orders.map((result) => (
                    <CommandItem
                      key={result.id}
                      value={`order-${result.id}`}
                      onSelect={() => handleSearchResultSelect(result.url)}
                    >
                      {getSearchIcon(result.type)}
                      <div className="flex-1">
                        <div className="font-medium">{result.title}</div>
                        {result.subtitle && (
                          <div className="text-sm text-muted-foreground">
                            {result.subtitle}
                          </div>
                        )}
                      </div>
                      {result.meta && (
                        <div className="text-sm text-muted-foreground">{result.meta}</div>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>

      {/* Expose method to open command palette programmatically */}
      <button
        onClick={() => setOpen(true)}
        className="sr-only"
        aria-label="Open command palette"
        id="command-palette-trigger"
      />
    </>
  );
}
