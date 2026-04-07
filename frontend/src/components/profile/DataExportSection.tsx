'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { BRAND } from '@/lib/store-config'

export function DataExportSection() {
  const t = useTranslations('Profile')
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const response = await fetch('/api/profile/export', {
        credentials: 'include',
      })

      if (response.status === 429) {
        const data = await response.json()
        toast.error(data.error || t('dataExportError'))
        return
      }

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${BRAND.name.toLowerCase()}-data-export.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(t('dataExportSuccess'))
    } catch {
      toast.error(t('dataExportError'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-6">
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {t('dataExport')}
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        {t('dataExportDescription')}
      </p>
      <Button
        variant="outline"
        onClick={handleExport}
        disabled={isExporting}
      >
        {isExporting ? (
          <Loader2 className="size-4 animate-spin mr-2" />
        ) : (
          <Download className="size-4 mr-2" />
        )}
        {isExporting ? t('dataExporting') : t('dataExportButton')}
      </Button>
    </div>
  )
}
