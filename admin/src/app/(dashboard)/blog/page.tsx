'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Eye } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/admin-api';
import { toast } from 'sonner';

type BlogPost = {
  id: string;
  slug: string;
  title_en: string;
  title_es: string;
  title_de: string;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  views: number;
  created_at: string;
};

export default function BlogPage() {
  const queryClient = useQueryClient();

  // Fetch blog posts
  const { data, isLoading, error } = useQuery({
    queryKey: ['blog-posts'],
    queryFn: async () => {
      const res = await adminFetch('/api/blog');
      if (!res.ok) throw new Error('Failed to fetch blog posts');
      return res.json();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await adminFetch(`/api/blog/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete blog post');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] });
      toast.success('Blog post deleted');
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error('Failed to delete blog post');
    },
  });

  const posts: BlogPost[] = data?.posts || [];

  function handleDelete(id: string, title: string) {
    if (confirm(`Delete blog post "${title}"?`)) {
      deleteMutation.mutate(id);
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Blog Posts</h1>
        <Button disabled title="Coming soon">
          <Plus className="h-4 w-4 mr-2" />
          Create Post
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Posts ({posts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : error ? (
            <p className="text-destructive">Failed to load blog posts</p>
          ) : posts.length === 0 ? (
            <p className="text-muted-foreground">No blog posts yet. Create your first post!</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title (EN)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium">{post.title_en}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          post.status === 'published'
                            ? 'default'
                            : post.status === 'draft'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {post.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {post.published_at
                        ? new Date(post.published_at).toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                    <TableCell>{post.views}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" disabled title="Coming soon">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(post.id, post.title_en)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {post.status === 'published' && (
                          <Button size="sm" variant="ghost" asChild>
                            <a
                              href={`${process.env.NEXT_PUBLIC_BASE_URL!}/en/blog/${post.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Eye className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
