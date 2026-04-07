'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, Image as ImageIcon } from 'lucide-react';
import { I18nField } from './I18nField';
import type { CampaignFormData } from './types';

interface CampaignEditorProps {
  campaign: CampaignFormData;
  isNew: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CampaignFormData) => Promise<void>;
  saving: boolean;
}

export function CampaignEditor({
  campaign,
  isNew,
  open,
  onOpenChange,
  onSave,
  saving,
}: CampaignEditorProps) {
  const [form, setForm] = useState<CampaignFormData>(campaign);

  // Sync form when campaign prop changes (e.g. switching between edit targets)
  useEffect(() => {
    setForm(campaign);
  }, [campaign]);

  const updateField = <K extends keyof CampaignFormData>(key: K, value: CampaignFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(form);
  };

  // Auto-generate slug from name if slug is empty
  const handleNameChange = (name: string) => {
    updateField('name', name);
    if (isNew && !form.slug) {
      updateField('slug', name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Create Campaign' : 'Edit Campaign'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="max-h-[65vh] pr-4">
            <div className="space-y-6 py-2">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Internal Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Spring 2026 Campaign"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={form.slug}
                    onChange={(e) => updateField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="spring-2026"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => updateField('status', v as CampaignFormData['status'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    min={0}
                    max={100}
                    value={form.priority}
                    onChange={(e) => updateField('priority', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-muted-foreground">Higher = shown first</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cta_url">CTA URL</Label>
                  <Input
                    id="cta_url"
                    value={form.cta_url}
                    onChange={(e) => updateField('cta_url', e.target.value)}
                    placeholder="/shop"
                  />
                </div>
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="starts_at">Starts At</Label>
                  <Input
                    id="starts_at"
                    type="datetime-local"
                    value={form.starts_at ? form.starts_at.slice(0, 16) : ''}
                    onChange={(e) => updateField('starts_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ends_at">Ends At</Label>
                  <Input
                    id="ends_at"
                    type="datetime-local"
                    value={form.ends_at ? form.ends_at.slice(0, 16) : ''}
                    onChange={(e) => updateField('ends_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                  />
                </div>
              </div>

              <Separator />

              {/* i18n Content Fields */}
              <I18nField
                label="Hero Title"
                value={form.title}
                onChange={(v) => updateField('title', v)}
                placeholder="Main headline"
              />

              <I18nField
                label="Subtitle"
                value={form.subtitle}
                onChange={(v) => updateField('subtitle', v)}
                placeholder="Subtitle or tagline"
              />

              <I18nField
                label="CTA Button Text"
                value={form.cta_text}
                onChange={(v) => updateField('cta_text', v)}
                placeholder="Shop Now"
              />

              <I18nField
                label="Sub-CTA Text"
                value={form.sub_cta_text}
                onChange={(v) => updateField('sub_cta_text', v)}
                placeholder="Free shipping over €50"
              />

              <I18nField
                label="Image Alt Text"
                value={form.image_alt}
                onChange={(v) => updateField('image_alt', v)}
                placeholder="Hero image description"
              />

              <Separator />

              {/* Images */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Images
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="image_url">Landing Page Hero Image</Label>
                  <Input
                    id="image_url"
                    value={form.image_url || ''}
                    onChange={(e) => updateField('image_url', e.target.value || null)}
                    placeholder="https://... (landing page hero)"
                  />
                  {form.image_url && (
                    <img src={form.image_url} alt="Landing preview" className="h-20 rounded border object-cover" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shop_hero_image_url">Shop Page Hero Image</Label>
                  <Input
                    id="shop_hero_image_url"
                    value={form.shop_hero_image_url || ''}
                    onChange={(e) => updateField('shop_hero_image_url', e.target.value || null)}
                    placeholder="https://... (shop page hero)"
                  />
                  {form.shop_hero_image_url && (
                    <img src={form.shop_hero_image_url} alt="Shop preview" className="h-20 rounded border object-cover" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="og_image_url">OG Image (Social Share)</Label>
                  <Input
                    id="og_image_url"
                    value={form.og_image_url || ''}
                    onChange={(e) => updateField('og_image_url', e.target.value || null)}
                    placeholder="https://... (1200x630 recommended)"
                  />
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : isNew ? 'Create Campaign' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
