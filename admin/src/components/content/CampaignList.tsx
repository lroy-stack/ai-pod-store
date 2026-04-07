'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pencil, Trash2, Copy } from 'lucide-react';
import type { Campaign } from './types';

interface CampaignListProps {
  campaigns: Campaign[];
  onEdit: (campaign: Campaign) => void;
  onDelete: (id: string) => void;
  onDuplicate: (campaign: Campaign) => void;
}

function statusVariant(status: string) {
  switch (status) {
    case 'active':
      return 'default' as const;
    case 'scheduled':
      return 'secondary' as const;
    case 'archived':
      return 'outline' as const;
    default:
      return 'outline' as const;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function CampaignList({ campaigns, onEdit, onDelete, onDuplicate }: CampaignListProps) {
  if (campaigns.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No campaigns found. Create your first hero campaign.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Title (EN)</TableHead>
          <TableHead>Schedule</TableHead>
          <TableHead>Images</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((c) => (
          <TableRow key={c.id}>
            <TableCell>
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.slug}</p>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
            </TableCell>
            <TableCell>{c.priority}</TableCell>
            <TableCell className="max-w-[200px] truncate">
              {c.title?.en || '—'}
            </TableCell>
            <TableCell>
              <div className="text-xs">
                <p>{formatDate(c.starts_at)}</p>
                <p className="text-muted-foreground">{formatDate(c.ends_at)}</p>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                {c.image_url && (
                  <Badge variant="outline" className="text-[10px]">Landing</Badge>
                )}
                {c.shop_hero_image_url && (
                  <Badge variant="outline" className="text-[10px]">Shop</Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => onEdit(c)} title="Edit">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDuplicate(c)} title="Duplicate">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(c.id)}
                  title="Delete"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
