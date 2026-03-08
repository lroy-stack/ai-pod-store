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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { Heart, ShoppingCart, Share2, Copy, Check, X, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useWishlist } from '@/hooks/useWishlist';
import { apiFetch } from '@/lib/api-fetch';
import { ProductGrid } from '@/components/products/ProductGrid';
import { ProductCard } from '@/components/products/ProductCard';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  image: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
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
  const { wishlistItems, loading: wishlistLoading } = useWishlist();

  // Auth mode: server wishlists
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  // Guest mode: product details fetched by IDs
  const [guestProducts, setGuestProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWishlistName, setNewWishlistName] = useState('');
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Auth mode: fetch wishlists from server
  useEffect(() => {
    if (user) {
      fetchWishlists();
    }
  }, [user]);

  // Guest mode: fetch product details for localStorage wishlist items
  useEffect(() => {
    if (!user && !wishlistLoading) {
      if (wishlistItems.length > 0) {
        fetchGuestProducts(wishlistItems);
      } else {
        setGuestProducts([]);
        setLoading(false);
      }
    }
  }, [user, wishlistItems, wishlistLoading]);

  const fetchWishlists = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/wishlist');
      const data = await response.json();
      setWishlists(data.wishlists || []);
    } catch (error) {
      console.error('Error fetching wishlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGuestProducts = async (productIds: string[]) => {
    try {
      setLoading(true);
      const ids = productIds.join(',');
      const response = await fetch(`/api/products?ids=${ids}`);
      const data = await response.json();
      if (data.success && data.items) {
        setGuestProducts(data.items);
      }
    } catch (error) {
      console.error('Error fetching guest products:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setNewWishlistName('');
    setCreateDialogOpen(true);
  };

  const createWishlist = async () => {
    if (!newWishlistName.trim()) return;

    try {
      const response = await apiFetch('/api/wishlist', {
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

  const addAllToCart = async (items: WishlistItem[]) => {
    try {
      for (const item of items) {
        await apiFetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: item.products.id,
            variant_id: item.variant_id,
            quantity: 1,
          }),
        });
      }
    } catch (error) {
      console.error('Error adding all items to cart:', error);
    }
  };

  const shareWishlist = async (wishlistId: string) => {
    try {
      const response = await apiFetch('/api/wishlist/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wishlist_id: wishlistId }),
      });

      if (response.ok) {
        const data = await response.json();
        setShareUrl(data.share_url);
        setShareDialogOpen(true);
        setCopied(false);
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

  const handleRenameWishlist = async () => {
    if (!renamingId || !renameValue.trim()) return;
    try {
      const response = await apiFetch('/api/wishlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wishlist_id: renamingId, name: renameValue.trim() }),
      });
      if (!response.ok) throw new Error('Failed to rename');
      toast.success(t('wishlist.renamed'));
      setRenameDialogOpen(false);
      setRenamingId(null);
      setRenameValue('');
      fetchWishlists();
    } catch {
      toast.error(t('wishlist.renameError'));
    }
  };

  const handleDeleteWishlist = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await apiFetch(`/api/wishlist?wishlist_id=${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      toast.success(t('wishlist.wishlistDeleted'));
      fetchWishlists();
    } catch {
      toast.error(t('wishlist.deleteError'));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || wishlistLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        </div>
        <ProductGrid products={[]} isLoading skeletonCount={6} />
      </div>
    );
  }

  // ==================== GUEST MODE ====================
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">
            {t('wishlist.myWishlist')}
          </h1>
        </div>

        {guestProducts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Heart className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {t('wishlist.empty')}
              </h2>
              <p className="text-muted-foreground mb-4 text-center">
                {t('wishlist.emptyDescription')}
              </p>
              <Link href="/shop">
                <Button>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {t('wishlist.browseProducts')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Promo bar — matches SignupBanner pattern */}
            {!bannerDismissed && (
              <div className="mb-4 px-4 py-2.5 bg-muted/60 border border-border/60 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
                <p className="text-xs text-muted-foreground">
                  {t('wishlist.signInHeadline')}
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href="/auth/register">
                    <Button size="sm" variant="default" className="h-7 text-xs px-3">
                      {t('wishlist.createAccount')}
                    </Button>
                  </Link>
                  <button
                    onClick={() => setBannerDismissed(true)}
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            <ProductGrid products={guestProducts} />
          </>
        )}
      </div>
    );
  }

  // ==================== AUTH MODE ====================
  const productGridClasses = 'neu-grid';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold text-foreground">
          {t('wishlist.title')}
        </h1>
        <Button onClick={openCreateDialog} className="w-full sm:w-auto">
          <Heart className="h-4 w-4 mr-2" />
          {t('wishlist.createNew')}
        </Button>
      </div>

      {wishlists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Heart className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {t('wishlist.empty')}
            </h2>
            <p className="text-muted-foreground mb-4 text-center">
              {t('wishlist.emptyDescription')}
            </p>
            <Button onClick={openCreateDialog}>
              <Heart className="h-4 w-4 mr-2" />
              {t('wishlist.createFirst')}
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
                        {t('wishlist.public')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRenamingId(wishlist.id);
                        setRenameValue(wishlist.name);
                        setRenameDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={deletingId === wishlist.id}>
                          {deletingId === wishlist.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('wishlist.deleteWishlistTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>{t('wishlist.deleteWishlistDescription')}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('wishlist.cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteWishlist(wishlist.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {t('wishlist.deleteWishlistConfirm')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shareWishlist(wishlist.id)}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      {t('wishlist.share')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addAllToCart(wishlist.wishlist_items)}
                      disabled={wishlist.wishlist_items.length === 0}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {t('wishlist.addAllToCart')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                {wishlist.wishlist_items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('wishlist.noItems')}
                  </div>
                ) : (
                  <div className={productGridClasses}>
                    {wishlist.wishlist_items.map((item) => (
                      <ProductCard
                        key={item.id}
                        product={item.products}
                      />
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
              {t('wishlist.createTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('wishlist.createDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Input
                value={newWishlistName}
                onChange={(e) => setNewWishlistName(e.target.value)}
                placeholder={t('wishlist.namePlaceholder')}
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
                {t('wishlist.cancel')}
              </Button>
              <Button
                onClick={createWishlist}
                disabled={!newWishlistName.trim()}
              >
                {t('wishlist.create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('wishlist.shareTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('wishlist.shareDescription')}
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
                  {t('wishlist.copied')}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  {t('wishlist.copy')}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('wishlist.renameTitle')}</DialogTitle>
            <DialogDescription>{t('wishlist.renameDescription')}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="wishlist-name">{t('wishlist.name')}</Label>
            <Input
              id="wishlist-name"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder={t('wishlist.renamePlaceholder')}
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRenameWishlist();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              {t('wishlist.cancel')}
            </Button>
            <Button onClick={handleRenameWishlist} disabled={!renameValue.trim()}>
              {t('wishlist.rename')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
