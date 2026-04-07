'use client'

import { useTranslations } from 'next-intl'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDesignEditor } from '@/hooks/useDesignEditor'
import { cn } from '@/lib/utils'

interface PanelSwitcherProps {
  onPanelChange: (panel: string) => void
  onCopyPanel?: (fromPanel: string, toPanel: string) => void
}

export function PanelSwitcher({ onPanelChange, onCopyPanel }: PanelSwitcherProps) {
  const t = useTranslations('designEditor.panels')
  const tEditor = useTranslations('designEditor')
  const { activePanel, availablePanels, panelStates } = useDesignEditor()

  if (availablePanels.length <= 1) return null

  const otherPanels = availablePanels.filter((p) => p !== activePanel)

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border bg-card overflow-x-auto shrink-0">
      {availablePanels.map((panel) => {
        const isActive = panel === activePanel
        const hasContent = panelStates[panel]?.fabricJson != null

        return (
          <Button
            key={panel}
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onPanelChange(panel)}
            className={cn(
              'relative text-xs font-medium whitespace-nowrap',
              !isActive && 'text-muted-foreground'
            )}
          >
            {t(panel)}
            {hasContent && !isActive && (
              <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-primary" />
            )}
          </Button>
        )
      })}

      {onCopyPanel && otherPanels.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 text-xs ml-1">
              <Copy className="size-3" />
              {tEditor('copyTo')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {otherPanels.map((target) => (
              <DropdownMenuItem
                key={target}
                onClick={() => onCopyPanel(activePanel, target)}
              >
                {t(target)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
