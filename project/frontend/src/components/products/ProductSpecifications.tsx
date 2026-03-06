'use client'

import { Shirt, Globe, Printer, Droplets, ShieldCheck, Sparkles } from 'lucide-react'
import { SafeHTML } from '@/components/common/SafeHTML'

interface ProductSpecificationsProps {
  materials?: string | null
  printTechnique?: string | null
  manufacturingCountry?: string | null
  careInstructions?: string | null
  safetyInformation?: string | null
  finish?: string | null
  labels?: {
    specifications: string
    materials: string
    printTechnique: string
    madeIn: string
    careInstructions: string
    safetyInformation: string
    finish?: string
  }
}

export function ProductSpecifications({
  materials,
  printTechnique,
  manufacturingCountry,
  careInstructions,
  safetyInformation,
  finish,
  labels,
}: ProductSpecificationsProps) {
  const hasAny = materials || printTechnique || manufacturingCountry || careInstructions || finish

  if (!hasAny && !safetyInformation) return null

  return (
    <div className="space-y-2.5">
      {labels?.specifications && (
        <h4 className="text-[13px] font-medium text-foreground/80">{labels.specifications}</h4>
      )}

      {materials && (
        <div className="flex items-start gap-2.5">
          <Shirt className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-foreground/80">{labels?.materials ?? 'Materials'}</p>
            <p className="text-xs text-muted-foreground">{materials}</p>
          </div>
        </div>
      )}

      {finish && (
        <div className="flex items-start gap-2.5">
          <Sparkles className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-foreground/80">{labels?.finish ?? 'Finish'}</p>
            <p className="text-xs text-muted-foreground">{finish}</p>
          </div>
        </div>
      )}

      {printTechnique && (
        <div className="flex items-start gap-2.5">
          <Printer className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-foreground/80">{labels?.printTechnique ?? 'Print technique'}</p>
            <p className="text-xs text-muted-foreground">{printTechnique}</p>
          </div>
        </div>
      )}

      {manufacturingCountry && (
        <div className="flex items-start gap-2.5">
          <Globe className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-foreground/80">{labels?.madeIn ?? 'Made in'}</p>
            <p className="text-xs text-muted-foreground">{manufacturingCountry}</p>
          </div>
        </div>
      )}

      {careInstructions && (
        <div className="flex items-start gap-2.5">
          <Droplets className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-foreground/80">{labels?.careInstructions ?? 'Care instructions'}</p>
            <p className="text-xs text-muted-foreground">{careInstructions}</p>
          </div>
        </div>
      )}

      {safetyInformation && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ShieldCheck className="size-3.5 shrink-0" />
            {labels?.safetyInformation ?? 'Safety information'}
            <span className="ml-auto text-[10px] group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <SafeHTML
            html={safetyInformation}
            className="mt-1.5 text-xs text-muted-foreground [&_p]:my-0.5 [&_strong]:text-foreground"
          />
        </details>
      )}
    </div>
  )
}
