'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, ShoppingCart } from 'lucide-react';

interface Product {
  id: string;
  title: string;
  description: string;
  base_price: number;
  images: string[];
}

interface WishlistItem {
  id: string;
  product_id: string;
  variant_id: string | null;
  added_at: string;
  products: Product;
}

interface Wishlist {
  id: string;
  name: string;
  is_public: boolean;
  created_at: string;
  wishlist_items: WishlistItem[];
}

export default function SharedWishlistPage() {
  const t = useTranslations();
  const params = useParams();
  const token = params.token as string;

  const [wishlist, setWishlist] = useState<Wishlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchSharedWishlist();
    }
  }, [token]);

  const fetchSharedWishlist = async () => {
    try {
      const response = await fetch(`/api/wishlist/shared/${token}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Wishlist not found or is no longer public');
        } else {
          setError('Failed to load wishlist');
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      setWishlist(data.wishlist);
    } catch (err) {
      console.error('Error fetching shared wishlist:', err);
      setError('Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (productId: string, variantId: string | null) => {
    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          variant_id: variantId,
          quantity: 1,
        }),
      });

      if (response.ok) {
        console.log('Added to cart');
        // Optionally show success toast
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        </div>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 w-48 bg-muted rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-40 bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !wishlist) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Heart className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {t('wishlist.sharedNotFound', {
                default: 'Wishlist Not Found',
              })}
            </h2>
            <p className="text-muted-foreground mb-4 text-center">
              {error || t('wishlist.sharedNotFoundDescription', {
                default: 'This wishlist may have been deleted or is no longer public.',
              })}
            </p>
            <Link href="/en/shop">
              <Button>
                {t('wishlist.browseProducts', { default: 'Browse Products' })}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-foreground">{wishlist.name}</h1>
          <Badge variant="outline">
            {t('wishlist.sharedList', { default: 'Shared Wishlist' })}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          {t('wishlist.itemCount', {
            default: `{count, plural, =0 {No items} one {1 item} other {{count} items}}`,
            count: wishlist.wishlist_items.length,
          })}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {wishlist.wishlist_items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Heart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p>
                {t('wishlist.noItems', {
                  default: 'No items in this wishlist yet',
                })}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {wishlist.wishlist_items.map((item) => (
                <div
                  key={item.id}
                  className="border border-border rounded-lg p-4 hover:border-primary transition-colors"
                >
                  <Link
                    href={`/shop/${item.products.id}`}
                    className="block"
                  >
                    <div className="relative aspect-square mb-3 bg-muted rounded-md overflow-hidden">
                      <Image
                        src={item.products.images[0] || '/placeholder.png'}
                        alt={item.products.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1 line-clamp-2">
                      {item.products.title}
                    </h3>
                    <p className="text-sm text-primary font-semibold">
                      ${item.products.base_price.toFixed(2)}
                    </p>
                  </Link>
                  <div className="mt-3">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => addToCart(item.products.id, item.variant_id)}
                    >
                      <ShoppingCart className="h-3 w-3 mr-1" />
                      {t('wishlist.addToCart', { default: 'Add to Cart' })}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
