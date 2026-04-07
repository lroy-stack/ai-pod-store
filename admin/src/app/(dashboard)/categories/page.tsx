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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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

const emptyForm = {
  slug: '',
  name_en: '',
  name_es: '',
  name_de: '',
  icon: '',
  sort_order: 0,
};

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

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
    onError: () => {
      toast.error('Failed to update category');
    },
  });

  // Create / update category
  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = editingId
        ? `/api/admin/categories/${editingId}`
        : '/api/admin/categories';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await adminFetch(url, {
        method,
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Save failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      toast.success(editingId ? 'Category updated' : 'Category created');
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: () => {
      toast.error('Failed to save category');
    },
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(cat: Category) {
    setEditingId(cat.id);
    setForm({
      slug: cat.slug,
      name_en: cat.name_en,
      name_es: cat.name_es,
      name_de: cat.name_de,
      icon: cat.icon,
      sort_order: cat.sort_order,
    });
    setDialogOpen(true);
  }

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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Category' : 'Create Category'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Slug *</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="t-shirts"
                    disabled={!!editingId}
                  />
                </div>
                <div>
                  <Label>Icon</Label>
                  <Input
                    value={form.icon}
                    onChange={(e) => setForm(prev => ({ ...prev, icon: e.target.value }))}
                    placeholder="e.g. emoji"
                  />
                </div>
              </div>
              <div>
                <Label>English Name *</Label>
                <Input
                  value={form.name_en}
                  onChange={(e) => setForm(prev => ({ ...prev, name_en: e.target.value }))}
                  placeholder="T-Shirts"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Spanish Name</Label>
                  <Input
                    value={form.name_es}
                    onChange={(e) => setForm(prev => ({ ...prev, name_es: e.target.value }))}
                    placeholder="Camisetas"
                  />
                </div>
                <div>
                  <Label>German Name</Label>
                  <Input
                    value={form.name_de}
                    onChange={(e) => setForm(prev => ({ ...prev, name_de: e.target.value }))}
                    placeholder="T-Shirts"
                  />
                </div>
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !form.slug || !form.name_en}
                >
                  {saveMutation.isPending ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
                          <Button variant="ghost" size="icon" title="Edit category" onClick={() => openEdit(category)}>
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
