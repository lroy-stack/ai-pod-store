'use client'

import { useTranslations } from 'next-intl'
import { MousePointer2, Type, ImageIcon, Layers, LayoutTemplate, Sticker, Palette, Undo2, Redo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useDesignEditor, type DesignTool } from '@/hooks/useDesignEditor'

interface CanvasToolbarProps {
  onUndo: () => void
  onRedo: () => void
}

const TOOLS: Array<{ id: DesignTool; icon: typeof MousePointer2; labelKey: string }> = [
  { id: 'select', icon: MousePointer2, labelKey: 'tools.select' },
  { id: 'text', icon: Type, labelKey: 'tools.text' },
  { id: 'image', icon: ImageIcon, labelKey: 'tools.image' },
  { id: 'layers', icon: Layers, labelKey: 'tools.layers' },
  { id: 'templates', icon: LayoutTemplate, labelKey: 'tools.templates' },
  { id: 'clipart', icon: Sticker, labelKey: 'tools.clipart' },
  { id: 'my-designs', icon: Palette, labelKey: 'tools.myDesigns' },
]

export function CanvasToolbar({ onUndo, onRedo }: CanvasToolbarProps) {
  const t = useTranslations('designEditor')
  const { activeTool, setActiveTool, canUndo, canRedo } = useDesignEditor()

  return (
    <>
      {/* Desktop: vertical left sidebar */}
      <div className="hidden lg:flex flex-col items-center gap-1 p-2 border-r border-border bg-card w-14 shrink-0">
        {TOOLS.map(({ id, icon: Icon, labelKey }) => (
          <Button
            key={id}
            variant={activeTool === id ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setActiveTool(id)}
            title={t(labelKey)}
            className="size-10"
          >
            <Icon className="size-5" />
          </Button>
        ))}
        <Separator className="my-1 w-8" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onUndo}
          disabled={!canUndo}
          title={t('history.undo')}
          className="size-10"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRedo}
          disabled={!canRedo}
          title={t('history.redo')}
          className="size-10"
        >
          <Redo2 className="size-4" />
        </Button>
      </div>

      {/* Mobile: horizontal bottom bar — icons only, scrollable */}
      <div className="flex lg:hidden items-center gap-1 p-1.5 border-t border-border bg-card shrink-0 overflow-x-auto">
        {TOOLS.map(({ id, icon: Icon, labelKey }) => (
          <Button
            key={id}
            variant={activeTool === id ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setActiveTool(id)}
            title={t(labelKey)}
            className="size-10 shrink-0"
          >
            <Icon className="size-4" />
          </Button>
        ))}
        <Separator orientation="vertical" className="h-6 mx-0.5 shrink-0" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onUndo}
          disabled={!canUndo}
          title={t('history.undo')}
          className="size-10 shrink-0"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRedo}
          disabled={!canRedo}
          title={t('history.redo')}
          className="size-10 shrink-0"
        >
          <Redo2 className="size-4" />
        </Button>
      </div>
    </>
  )
}
