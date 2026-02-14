'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, ShoppingCart, Share2, Trash2, Copy, Check } from 'lucide-react';
import { formatPrice } from '@/lib/currency';
import { useAuth } from '@/hooks/useAuth';

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
  share_token: string | null;
  created_at: string;
  wishlist_items: WishlistItem[];
}

export default function WishlistPage() {
  const t = useTranslations();
  const { user } = useAuth();
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [loading, setLoading] = useState(true);

  // Get user's preferred currency, fallback to EUR
  const userCurrency = user?.currency || 'EUR';
  const userLocale = user?.locale || 'en';
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWishlistName, setNewWishlistName] = useState('');

  useEffect(() => {
    fetchWishlists();
  }, []);

  const fetchWishlists = async () => {
    try {
      const response = await fetch('/api/wishlist');
      const data = await response.json();
      setWishlists(data.wishlists || []);
    } catch (error) {
      console.error('Error fetching wishlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setNewWishlistName('');
    setCreateDialogOpen(true);
  };

  const createWishlist = async () => {
    if (!newWishlistName.trim()) {
      return;
    }

    try {
      const response = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWishlistName.trim() }),
      });

      if (response.ok) {
        setCreateDialogOpen(false);
        setNewWishlistName('');
        await fetchWishlists();
      }
    } catch (error) {
      console.error('Error creating wishlist:', error);
    }
  };

  const removeFromWishlist = async (itemId: string) => {
    try {
      const response = await fetch(`/api/wishlist/items?item_id=${itemId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchWishlists();
      }
    } catch (error) {
      console.error('Error removing item from wishlist:', error);
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
        // Optionally show success toast
        console.log('Added to cart');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const addAllToCart = async (wishlistItems: WishlistItem[]) => {
    try {
      // Add each item to cart sequentially
      for (const item of wishlistItems) {
        await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: item.products.id,
            variant_id: item.variant_id,
            quantity: 1,
          }),
        });
      }
      // Optionally show success toast
      console.log(`Added ${wishlistItems.length} items to cart`);
    } catch (error) {
      console.error('Error adding all items to cart:', error);
    }
  };

  const shareWishlist = async (wishlistId: string) => {
    try {
      const response = await fetch('/api/wishlist/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wishlist_id: wishlistId }),
      });

      if (response.ok) {
        const data = await response.json();
        setShareUrl(data.share_url);
        setShareDialogOpen(true);
        setCopied(false);
        // Refresh wishlists to show updated is_public status
        await fetchWishlists();
      }
    } catch (error) {
      console.error('Error sharing wishlist:', error);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid gap-6">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold text-foreground">
          {t('wishlist.title', { default: 'My Wishlists' })}
        </h1>
        <Button onClick={openCreateDialog} className="w-full sm:w-auto">
          <Heart className="h-4 w-4 mr-2" />
          {t('wishlist.createNew', { default: 'Create New Wishlist' })}
        </Button>
      </div>

      {wishlists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Heart className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {t('wishlist.empty', { default: 'No wishlists yet' })}
            </h2>
            <p className="text-muted-foreground mb-4 text-center">
              {t('wishlist.emptyDescription', {
                default: 'Create a wishlist to save your favorite products',
              })}
            </p>
            <Button onClick={openCreateDialog}>
              <Heart className="h-4 w-4 mr-2" />
              {t('wishlist.createFirst', { default: 'Create Your First Wishlist' })}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {wishlists.map((wishlist) => (
            <Card key={wishlist.id}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-xl">{wishlist.name}</CardTitle>
                    {wishlist.is_public && (
                      <Badge variant="outline">
                        {t('wishlist.public', { default: 'Public' })}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shareWishlist(wishlist.id)}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      {t('wishlist.share', { default: 'Share' })}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addAllToCart(wishlist.wishlist_items)}
                      disabled={wishlist.wishlist_items.length === 0}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {t('wishlist.addAllToCart', { default: 'Add All to Cart' })}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                {wishlist.wishlist_items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('wishlist.noItems', {
                      default: 'No items in this wishlist yet',
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {wishlist.wishlist_items.map((item) => (
                      <div
                        key={item.id}
                        className="border border-border rounded-lg p-4 hover:border-primary transition-colors"
                      >
                        <Link
                          href={`/products/${item.products.id}`}
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
                            {formatPrice(item.products.base_price, userLocale, userCurrency)}
                          </p>
                        </Link>
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => addToCart(item.products.id, item.variant_id)}
                          >
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            {t('wishlist.addToCart', { default: 'Add to Cart' })}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeFromWishlist(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('wishlist.createTitle', { default: 'Create New Wishlist' })}
            </DialogTitle>
            <DialogDescription>
              {t('wishlist.createDescription', {
                default: 'Give your wishlist a name to organize your favorite products',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Input
                value={newWishlistName}
                onChange={(e) => setNewWishlistName(e.target.value)}
                placeholder={t('wishlist.namePlaceholder', {
                  default: 'e.g., Gifts, Favorites, Summer Collection',
                })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    createWishlist();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                {t('wishlist.cancel', { default: 'Cancel' })}
              </Button>
              <Button
                onClick={createWishlist}
                disabled={!newWishlistName.trim()}
              >
                {t('wishlist.create', { default: 'Create' })}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('wishlist.shareTitle', { default: 'Share Wishlist' })}
            </DialogTitle>
            <DialogDescription>
              {t('wishlist.shareDescription', {
                default: 'Anyone with this link can view your wishlist',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Input
              value={shareUrl}
              readOnly
              className="flex-1"
              onClick={(e) => e.currentTarget.select()}
            />
            <Button onClick={copyToClipboard} variant="outline">
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {t('wishlist.copied', { default: 'Copied' })}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  {t('wishlist.copy', { default: 'Copy' })}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
