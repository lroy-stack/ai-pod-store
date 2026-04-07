'use client';

import { useState, useEffect } from 'react';
import { adminFetch } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Star, Check, X, MessageSquare, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type Review = {
  id: string;
  product_id: string;
  user_id: string;
  order_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  images: string[];
  is_verified_purchase: boolean;
  locale: string;
  moderation_status: 'pending' | 'approved' | 'rejected';
  moderation_notes: string | null;
  moderated_by: string | null;
  moderated_at: string | null;
  created_at: string;
  products: {
    id: string;
    title: string;
    slug: string;
  };
  users: {
    id: string;
    email: string;
    name: string | null;
  };
};

export default function ReviewModerationPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [moderationNotes, setModerationNotes] = useState('');

  useEffect(() => {
    fetchReviews();
  }, [statusFilter]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/reviews?status=${statusFilter}&limit=100`);
      if (!res.ok) throw new Error('Failed to fetch reviews');
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const moderateReview = async (reviewId: string, status: 'approved' | 'rejected', notes?: string) => {
    try {
      const res = await adminFetch(`/api/reviews/${reviewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moderation_status: status,
          moderation_notes: notes || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to moderate review');

      // Refresh reviews list
      await fetchReviews();
      setEditingId(null);
      setModerationNotes('');
    } catch (error) {
      console.error('Error moderating review:', error);
      toast.error('Failed to moderate review');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-success/10 text-success hover:bg-success/20">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? 'fill-warning text-warning' : 'text-muted'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Review Moderation</h1>
          <p className="text-muted-foreground">Approve, reject, or respond to customer reviews</p>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reviews</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {reviews.length} review{reviews.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading reviews...</p>
        </div>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">No {statusFilter !== 'all' ? statusFilter : ''} reviews</p>
            <p className="text-sm text-muted-foreground">
              {statusFilter === 'pending'
                ? 'All reviews have been moderated'
                : 'Try changing the filter'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                      {renderStars(review.rating)}
                      {review.is_verified_purchase && (
                        <Badge variant="outline" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Verified Purchase
                        </Badge>
                      )}
                      {getStatusBadge(review.moderation_status)}
                    </div>
                    <CardTitle className="text-lg">{review.title || '(No title)'}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{review.users?.name || review.users?.email || 'Unknown user'}</span>
                      <span>•</span>
                      <span>{new Date(review.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span className="uppercase">{review.locale}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">Product</p>
                  <p className="text-sm text-muted-foreground">
                    {review.products?.title || 'Unknown product'}
                  </p>
                </div>

                {review.body && (
                  <div>
                    <p className="text-sm font-medium mb-1">Review</p>
                    <p className="text-sm">{review.body}</p>
                  </div>
                )}

                {review.moderation_notes && (
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm font-medium mb-1">Moderation Notes</p>
                    <p className="text-sm text-muted-foreground">{review.moderation_notes}</p>
                    {review.moderated_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Moderated on {new Date(review.moderated_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                {editingId === review.id && (
                  <div className="space-y-3 border-t pt-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Moderation Notes (Optional)</label>
                      <Textarea
                        value={moderationNotes}
                        onChange={(e) => setModerationNotes(e.target.value)}
                        placeholder="Add internal notes about this review..."
                        rows={3}
                      />
                    </div>
                  </div>
                )}

                {review.moderation_status === 'pending' && (
                  <div className="flex gap-2 border-t pt-4">
                    {editingId === review.id ? (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => moderateReview(review.id, 'approved', moderationNotes)}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => moderateReview(review.id, 'rejected', moderationNotes)}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(null);
                            setModerationNotes('');
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => moderateReview(review.id, 'approved')}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => moderateReview(review.id, 'rejected')}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(review.id);
                            setModerationNotes(review.moderation_notes || '');
                          }}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Add Notes
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
