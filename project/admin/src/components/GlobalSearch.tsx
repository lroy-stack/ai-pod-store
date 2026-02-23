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
} from '@/components/ui/command';
import { Package, ShoppingCart, Users } from 'lucide-react';

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

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResults>({
    products: [],
    orders: [],
    customers: [],
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Handle keyboard shortcut
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

  // Debounced search
  useEffect(() => {
    if (search.trim().length === 0) {
      setResults({ products: [], orders: [], customers: [] });
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await adminFetch(`/api/search?q=${encodeURIComponent(search)}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.results || { products: [], orders: [], customers: [] });
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [search]);

  const handleSelect = useCallback(
    (url: string) => {
      setOpen(false);
      setSearch('');
      router.push(url);
    },
    [router]
  );

  const getIcon = (type: string) => {
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

  const hasResults =
    results.products.length > 0 ||
    results.orders.length > 0 ||
    results.customers.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder="Search products, orders, customers..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {!loading && !hasResults && search.trim().length > 0 && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}

        {loading && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Searching...
          </div>
        )}

        {results.products.length > 0 && (
          <CommandGroup heading="Products">
            {results.products.map((result) => (
              <CommandItem
                key={result.id}
                value={result.title}
                keywords={[result.title, result.subtitle]}
                onSelect={() => handleSelect(result.url)}
              >
                {getIcon(result.type)}
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

        {results.customers.length > 0 && (
          <CommandGroup heading="Customers">
            {results.customers.map((result) => (
              <CommandItem
                key={result.id}
                value={result.title}
                keywords={[result.title, result.subtitle]}
                onSelect={() => handleSelect(result.url)}
              >
                {getIcon(result.type)}
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

        {results.orders.length > 0 && (
          <CommandGroup heading="Orders">
            {results.orders.map((result) => (
              <CommandItem
                key={result.id}
                value={result.title}
                keywords={[result.title, result.subtitle]}
                onSelect={() => handleSelect(result.url)}
              >
                {getIcon(result.type)}
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
      </CommandList>
    </CommandDialog>
  );
}
