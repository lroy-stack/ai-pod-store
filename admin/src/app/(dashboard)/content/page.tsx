'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Megaphone } from 'lucide-react';
import { adminFetch } from '@/lib/admin-api';
import { toast } from 'sonner';
import { CampaignList } from '@/components/content/CampaignList';
import { CampaignEditor } from '@/components/content/CampaignEditor';
import type { Campaign, CampaignFormData } from '@/components/content/types';
import { EMPTY_CAMPAIGN } from '@/components/content/types';

export default function ContentPage() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignFormData>(EMPTY_CAMPAIGN);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch campaigns
  const { data, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/campaigns');
      if (!res.ok) throw new Error('Failed to fetch campaigns');
      return res.json() as Promise<{ campaigns: Campaign[] }>;
    },
  });

  const campaigns = data?.campaigns || [];
  const activeCampaign = campaigns.find((c) => c.status === 'active');

  // Save mutation (create or update)
  const saveMutation = useMutation({
    mutationFn: async (formData: CampaignFormData) => {
      const url = editingId
        ? `/api/admin/campaigns/${editingId}`
        : '/api/admin/campaigns';
      const method = editingId ? 'PUT' : 'POST';

      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save campaign');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setEditorOpen(false);
      setEditingId(null);
      toast.success(editingId ? 'Campaign updated' : 'Campaign created');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await adminFetch(`/api/admin/campaigns/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete campaign');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setDeleteId(null);
      toast.success('Campaign deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleCreate = () => {
    setEditingCampaign(EMPTY_CAMPAIGN);
    setEditingId(null);
    setEditorOpen(true);
  };

  const handleEdit = (campaign: Campaign) => {
    setEditingCampaign({
      slug: campaign.slug,
      name: campaign.name,
      status: campaign.status,
      priority: campaign.priority,
      starts_at: campaign.starts_at,
      ends_at: campaign.ends_at,
      title: campaign.title || { en: '', es: '', de: '' },
      subtitle: campaign.subtitle || { en: '', es: '', de: '' },
      cta_text: campaign.cta_text || { en: '', es: '', de: '' },
      cta_url: campaign.cta_url,
      sub_cta_text: campaign.sub_cta_text || { en: '', es: '', de: '' },
      image_url: campaign.image_url,
      shop_hero_image_url: campaign.shop_hero_image_url,
      image_alt: campaign.image_alt || { en: '', es: '', de: '' },
      og_image_url: campaign.og_image_url,
      collection_id: campaign.collection_id,
    });
    setEditingId(campaign.id);
    setEditorOpen(true);
  };

  const handleDuplicate = (campaign: Campaign) => {
    setEditingCampaign({
      slug: `${campaign.slug}-copy`,
      name: `${campaign.name} (Copy)`,
      status: 'draft',
      priority: campaign.priority,
      starts_at: null,
      ends_at: null,
      title: campaign.title || { en: '', es: '', de: '' },
      subtitle: campaign.subtitle || { en: '', es: '', de: '' },
      cta_text: campaign.cta_text || { en: '', es: '', de: '' },
      cta_url: campaign.cta_url,
      sub_cta_text: campaign.sub_cta_text || { en: '', es: '', de: '' },
      image_url: campaign.image_url,
      shop_hero_image_url: campaign.shop_hero_image_url,
      image_alt: campaign.image_alt || { en: '', es: '', de: '' },
      og_image_url: campaign.og_image_url,
      collection_id: campaign.collection_id,
    });
    setEditingId(null);
    setEditorOpen(true);
  };

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content Manager</h1>
          <p className="text-muted-foreground mt-2">
            Manage hero banners, dynamic text, and page content for Landing and Shop pages
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Active campaign summary */}
      {activeCampaign && (
        <Card className="mb-6 border-primary/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Megaphone className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">
                    Active: <span className="text-primary">{activeCampaign.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeCampaign.title?.en || 'No title set'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">Live</Badge>
                <Button variant="outline" size="sm" onClick={() => handleEdit(activeCampaign)}>
                  Edit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList>
          <TabsTrigger value="campaigns">Hero Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Hero Campaigns</CardTitle>
              <CardDescription>
                Hero banners for Landing page and Shop page. The active campaign with highest priority is shown.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading campaigns...</div>
              ) : (
                <CampaignList
                  campaigns={campaigns}
                  onEdit={handleEdit}
                  onDelete={(id) => setDeleteId(id)}
                  onDuplicate={handleDuplicate}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Campaign Editor Dialog */}
      <CampaignEditor
        campaign={editingCampaign}
        isNew={!editingId}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSave={(data) => saveMutation.mutateAsync(data)}
        saving={saveMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
