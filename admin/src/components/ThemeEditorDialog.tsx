'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { OklchColorPicker } from './OklchColorPicker';
import { Settings } from 'lucide-react';

interface Theme {
  id: string;
  name: string;
  css_variables: Record<string, string>;
  css_variables_dark: Record<string, string>;
  fonts: {
    heading: string;
    body: string;
    mono: string;
  };
  border_radius: string;
  shadow_preset: string;
}

interface ThemeEditorDialogProps {
  theme: Theme;
  onSave?: (updatedTheme: Theme) => void;
  trigger?: React.ReactNode;
}

const COLOR_VARIABLES = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'accent', label: 'Accent' },
  { key: 'muted', label: 'Muted' },
  { key: 'destructive', label: 'Destructive' },
  { key: 'background', label: 'Background' },
  { key: 'foreground', label: 'Foreground' },
  { key: 'card', label: 'Card' },
  { key: 'border', label: 'Border' },
  { key: 'ring', label: 'Ring' },
];

const GOOGLE_FONTS = [
  'Outfit',
  'Inter',
  'Roboto',
  'Playfair Display',
  'Montserrat',
  'Poppins',
  'Lato',
  'Oswald',
  'JetBrains Mono',
  'Merriweather',
];

const SHADOW_PRESETS = [
  { value: 'none', label: 'None', shadow: 'none' },
  { value: 'subtle', label: 'Subtle', shadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' },
  { value: 'medium', label: 'Medium', shadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' },
  { value: 'dramatic', label: 'Dramatic', shadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' },
];

export function ThemeEditorDialog({ theme, onSave, trigger }: ThemeEditorDialogProps) {
  const [open, setOpen] = useState(false);
  const [cssVariables, setCssVariables] = useState<Record<string, string>>({});
  const [cssVariablesDark, setCssVariablesDark] = useState<Record<string, string>>({});
  const [fonts, setFonts] = useState({ heading: '', body: '', mono: '' });
  const [borderRadius, setBorderRadius] = useState('0.5rem');
  const [shadowPreset, setShadowPreset] = useState('subtle');
  const [saving, setSaving] = useState(false);

  // Initialize CSS variables, fonts, border radius, and shadow preset from theme
  useEffect(() => {
    if (open) {
      setCssVariables({ ...theme.css_variables });
      setCssVariablesDark({ ...theme.css_variables_dark });
      setFonts({ ...theme.fonts });
      setBorderRadius(theme.border_radius || '0.5rem');
      setShadowPreset(theme.shadow_preset || 'subtle');
    }
  }, [open, theme]);

  const handleColorChange = (key: string, value: string) => {
    setCssVariables((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleDarkColorChange = (key: string, value: string) => {
    setCssVariablesDark((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleFontChange = (key: 'heading' | 'body' | 'mono', value: string) => {
    setFonts((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedTheme = {
        ...theme,
        css_variables: cssVariables,
        css_variables_dark: cssVariablesDark,
        fonts: fonts,
        border_radius: borderRadius,
        shadow_preset: shadowPreset,
      };

      if (onSave) {
        await onSave(updatedTheme);
      }

      setOpen(false);
    } catch (error) {
      console.error('Failed to save theme:', error);
    } finally {
      setSaving(false);
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Settings className="h-4 w-4 mr-2" />
      Customize
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize Theme: {theme.name}</DialogTitle>
          <DialogDescription>
            Adjust color values using oklch color space. Changes are shown in real-time.
          </DialogDescription>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-4">Color Variables</h3>
            <Tabs defaultValue="light" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="light">Light Mode</TabsTrigger>
                <TabsTrigger value="dark">Dark Mode</TabsTrigger>
              </TabsList>

              <TabsContent value="light" className="space-y-4 mt-4">
                {COLOR_VARIABLES.map((variable) => (
                  <OklchColorPicker
                    key={variable.key}
                    label={variable.label}
                    value={cssVariables[variable.key] || 'oklch(0.5 0.1 0)'}
                    onChange={(value) => handleColorChange(variable.key, value)}
                  />
                ))}
              </TabsContent>

              <TabsContent value="dark" className="space-y-4 mt-4">
                {COLOR_VARIABLES.map((variable) => (
                  <OklchColorPicker
                    key={`dark-${variable.key}`}
                    label={variable.label}
                    value={cssVariablesDark[variable.key] || 'oklch(0.5 0.1 0)'}
                    onChange={(value) => handleDarkColorChange(variable.key, value)}
                  />
                ))}
              </TabsContent>
            </Tabs>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-4">Typography</h3>
            <div className="space-y-4">
              {/* Heading Font */}
              <div className="space-y-2">
                <Label htmlFor="heading-font" className="text-sm font-medium">
                  Heading Font
                </Label>
                <Select
                  value={fonts.heading}
                  onValueChange={(value) => handleFontChange('heading', value)}
                >
                  <SelectTrigger id="heading-font">
                    <SelectValue placeholder="Select heading font" />
                  </SelectTrigger>
                  <SelectContent>
                    {GOOGLE_FONTS.map((font) => (
                      <SelectItem key={font} value={font}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Body Font */}
              <div className="space-y-2">
                <Label htmlFor="body-font" className="text-sm font-medium">
                  Body Font
                </Label>
                <Select
                  value={fonts.body}
                  onValueChange={(value) => handleFontChange('body', value)}
                >
                  <SelectTrigger id="body-font">
                    <SelectValue placeholder="Select body font" />
                  </SelectTrigger>
                  <SelectContent>
                    {GOOGLE_FONTS.map((font) => (
                      <SelectItem key={font} value={font}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Monospace Font */}
              <div className="space-y-2">
                <Label htmlFor="mono-font" className="text-sm font-medium">
                  Monospace Font
                </Label>
                <Select
                  value={fonts.mono}
                  onValueChange={(value) => handleFontChange('mono', value)}
                >
                  <SelectTrigger id="mono-font">
                    <SelectValue placeholder="Select monospace font" />
                  </SelectTrigger>
                  <SelectContent>
                    {GOOGLE_FONTS.map((font) => (
                      <SelectItem key={font} value={font}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-4">Border Radius</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="border-radius" className="text-sm font-medium">
                  Corner Roundness
                </Label>
                <span className="text-sm text-muted-foreground">{borderRadius}</span>
              </div>
              <input
                id="border-radius"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={parseFloat(borderRadius)}
                onChange={(e) => setBorderRadius(`${e.target.value}rem`)}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex items-center gap-4">
                <div
                  className="w-20 h-20 bg-primary"
                  style={{ borderRadius }}
                  title={`Preview: ${borderRadius}`}
                />
                <p className="text-xs text-muted-foreground">
                  Preview of border radius applied to UI elements
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-4">Shadow Preset</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shadow-preset" className="text-sm font-medium">
                  Shadow Style
                </Label>
                <Select value={shadowPreset} onValueChange={setShadowPreset}>
                  <SelectTrigger id="shadow-preset">
                    <SelectValue placeholder="Select shadow preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {SHADOW_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4">
                <div
                  className="w-20 h-20 bg-card rounded-lg"
                  style={{
                    boxShadow:
                      SHADOW_PRESETS.find((p) => p.value === shadowPreset)?.shadow || 'none',
                  }}
                  title={`Preview: ${shadowPreset}`}
                />
                <p className="text-xs text-muted-foreground">
                  Preview of shadow applied to cards and elevated elements
                </p>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
