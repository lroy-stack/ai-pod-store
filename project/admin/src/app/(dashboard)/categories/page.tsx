'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Plus, Pencil, Eye, EyeOff } from 'lucide-react';
import { adminFetch } from '@/lib/admin-api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Category {
  id: string;
  slug: string;
  name_en: string;
  name_es: string;
  name_de: string;
  icon: string;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  product_count?: number;
}

export default function CategoriesPage() {
  const queryClient = useQueryClient();

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const response = await adminFetch('/api/admin/categories');
      return response.json() as Promise<Category[]>;
    },
  });

  // Toggle category active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return adminFetch(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      toast.success('Category updated successfully');
    },
    onError: (error) => {
      console.error('Toggle active failed:', error);
      toast.error('Failed to update category');
    },
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8">
            <div className="text-center text-muted-foreground">Loading categories...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeCategories = categories.filter(c => c.is_active);
  const inactiveCategories = categories.filter(c => !c.is_active);

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Categories</h1>
          <p className="text-muted-foreground mt-1">
            Manage product categories and their i18n names
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Categories</CardTitle>
          <CardDescription>
            {activeCategories.length} active {activeCategories.length === 1 ? 'category' : 'categories'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeCategories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active categories
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Icon</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>English Name</TableHead>
                  <TableHead>Spanish Name</TableHead>
                  <TableHead>German Name</TableHead>
                  <TableHead>Sort Order</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeCategories
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <span className="text-lg">{category.icon}</span>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{category.slug}</code>
                      </TableCell>
                      <TableCell className="font-medium">{category.name_en}</TableCell>
                      <TableCell>{category.name_es}</TableCell>
                      <TableCell>{category.name_de}</TableCell>
                      <TableCell>{category.sort_order}</TableCell>
                      <TableCell>
                        {category.parent_id ? (
                          <Badge variant="secondary">Sub-category</Badge>
                        ) : (
                          <Badge variant="outline">Top-level</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{category.product_count || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" title="Edit category">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Deactivate category"
                            onClick={() => toggleActiveMutation.mutate({
                              id: category.id,
                              isActive: category.is_active
                            })}
                          >
                            <EyeOff className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {inactiveCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inactive Categories</CardTitle>
            <CardDescription>
              {inactiveCategories.length} inactive {inactiveCategories.length === 1 ? 'category' : 'categories'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>English Name</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveCategories.map((category) => (
                  <TableRow key={category.id} className="opacity-50">
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{category.slug}</code>
                    </TableCell>
                    <TableCell>{category.name_en}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActiveMutation.mutate({
                          id: category.id,
                          isActive: category.is_active
                        })}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Activate
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
