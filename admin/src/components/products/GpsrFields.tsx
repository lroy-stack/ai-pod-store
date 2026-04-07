'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  material: string;
  careInstructions: string;
  printTechnique: string;
  manufacturingCountry: string;
  errors: Record<string, string>;
  onFieldChange: (field: string, value: string) => void;
}

export function GpsrFields({
  material, careInstructions, printTechnique, manufacturingCountry, errors, onFieldChange,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>GPSR Compliance</CardTitle>
        <p className="text-sm text-muted-foreground">EU Regulation 2023/988 — required for all products sold in the EU</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="material">Material *</Label>
          <Input
            id="material"
            value={material}
            onChange={(e) => onFieldChange('material', e.target.value)}
            placeholder="e.g. 100% organic cotton, 280 GSM"
          />
          {errors.material && <p className="text-sm text-destructive mt-1">{errors.material}</p>}
        </div>

        <div>
          <Label htmlFor="care_instructions">Care Instructions *</Label>
          <Input
            id="care_instructions"
            value={careInstructions}
            onChange={(e) => onFieldChange('care_instructions', e.target.value)}
            placeholder="e.g. Machine wash cold, tumble dry low"
          />
          {errors.care_instructions && <p className="text-sm text-destructive mt-1">{errors.care_instructions}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Print Technique</Label>
            <Select value={printTechnique} onValueChange={(v) => onFieldChange('print_technique', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dtg">DTG (Direct-to-Garment)</SelectItem>
                <SelectItem value="embroidery">Embroidery</SelectItem>
                <SelectItem value="sublimation">Sublimation</SelectItem>
                <SelectItem value="dtfilm">DTFilm/DTFlex</SelectItem>
                <SelectItem value="uv">UV Print</SelectItem>
                <SelectItem value="screen">Screen Print</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Manufacturing Country</Label>
            <Select value={manufacturingCountry} onValueChange={(v) => onFieldChange('manufacturing_country', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LV">Latvia (Printful EU)</SelectItem>
                <SelectItem value="DE">Germany</SelectItem>
                <SelectItem value="ES">Spain</SelectItem>
                <SelectItem value="PL">Poland</SelectItem>
                <SelectItem value="IT">Italy</SelectItem>
                <SelectItem value="CN">China</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
