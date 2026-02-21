'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface OklchColorPickerProps {
  label: string;
  value: string; // oklch(L C H) format
  onChange: (value: string) => void;
}

/**
 * Parse oklch string to L, C, H values
 * Example: "oklch(0.75 0.15 180)" -> { l: 0.75, c: 0.15, h: 180 }
 */
function parseOklch(oklchString: string): { l: number; c: number; h: number } {
  const match = oklchString.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
  if (match) {
    return {
      l: parseFloat(match[1]),
      c: parseFloat(match[2]),
      h: parseFloat(match[3]),
    };
  }
  // Default values if parsing fails
  return { l: 0.5, c: 0.1, h: 0 };
}

/**
 * Format L, C, H values to oklch string
 */
function formatOklch(l: number, c: number, h: number): string {
  return `oklch(${l.toFixed(2)} ${c.toFixed(2)} ${h.toFixed(0)})`;
}

/**
 * Convert oklch to hex for preview
 * Simplified conversion - in production you'd use a proper color library
 */
function oklchToHex(l: number, c: number, h: number): string {
  // This is a very simplified approximation
  // For proper conversion, use a library like culori
  // For now, just use hsl as a rough approximation
  const hue = h;
  const sat = Math.min(100, c * 250);
  const light = l * 100;

  // Convert HSL to RGB
  const hslToRgb = (h: number, s: number, l: number) => {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
  };

  const [r, g, b] = hslToRgb(hue, sat, light);
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

export function OklchColorPicker({ label, value, onChange }: OklchColorPickerProps) {
  const [l, setL] = useState(0.5);
  const [c, setC] = useState(0.1);
  const [h, setH] = useState(0);

  // Parse initial value only once
  useEffect(() => {
    const parsed = parseOklch(value);
    setL(parsed.l);
    setC(parsed.c);
    setH(parsed.h);
  }, []); // Only on mount

  const previewColor = oklchToHex(l, c, h);

  const handleLChange = (newL: number) => {
    setL(newL);
    onChange(formatOklch(newL, c, h));
  };

  const handleCChange = (newC: number) => {
    setC(newC);
    onChange(formatOklch(l, newC, h));
  };

  const handleHChange = (newH: number) => {
    setH(newH);
    onChange(formatOklch(l, c, newH));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center gap-2">
          <div
            className="w-10 h-10 rounded border-2 border-border"
            style={{ backgroundColor: previewColor }}
            title={formatOklch(l, c, h)}
          />
          <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
            {formatOklch(l, c, h)}
          </code>
        </div>
      </div>

      <div className="space-y-2">
        {/* Lightness slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">L (Lightness)</Label>
            <span className="text-xs text-muted-foreground">{l.toFixed(2)}</span>
          </div>
          <Input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={l}
            onChange={(e) => handleLChange(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Chroma slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">C (Chroma)</Label>
            <span className="text-xs text-muted-foreground">{c.toFixed(2)}</span>
          </div>
          <Input
            type="range"
            min="0"
            max="0.4"
            step="0.01"
            value={c}
            onChange={(e) => handleCChange(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Hue slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">H (Hue)</Label>
            <span className="text-xs text-muted-foreground">{h.toFixed(0)}°</span>
          </div>
          <Input
            type="range"
            min="0"
            max="360"
            step="1"
            value={h}
            onChange={(e) => handleHChange(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
