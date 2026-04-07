export interface Campaign {
  id: string;
  slug: string;
  name: string;
  status: 'draft' | 'scheduled' | 'active' | 'archived';
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  title: Record<string, string>;
  subtitle: Record<string, string>;
  cta_text: Record<string, string>;
  cta_url: string;
  sub_cta_text: Record<string, string>;
  image_url: string | null;
  shop_hero_image_url: string | null;
  image_alt: Record<string, string>;
  og_image_url: string | null;
  collection_id: string | null;
  collection?: { id: string; slug: string; name: Record<string, string> } | null;
  created_at: string;
  updated_at: string;
}

export type CampaignFormData = Omit<Campaign, 'id' | 'created_at' | 'updated_at' | 'collection'>;

export const LOCALES = ['en', 'es', 'de'] as const;

export const EMPTY_CAMPAIGN: CampaignFormData = {
  slug: '',
  name: '',
  status: 'draft',
  priority: 0,
  starts_at: null,
  ends_at: null,
  title: { en: '', es: '', de: '' },
  subtitle: { en: '', es: '', de: '' },
  cta_text: { en: '', es: '', de: '' },
  cta_url: '/shop',
  sub_cta_text: { en: '', es: '', de: '' },
  image_url: null,
  shop_hero_image_url: null,
  image_alt: { en: '', es: '', de: '' },
  og_image_url: null,
  collection_id: null,
};
