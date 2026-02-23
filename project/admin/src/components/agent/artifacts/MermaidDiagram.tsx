'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface MermaidDiagramProps {
  chart: string
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [svg, setSvg] = useState<string>('')

  useEffect(() => {
    let cancelled = false

    async function renderMermaid() {
      try {
        // Lazy load mermaid
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'strict',
        })

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const { svg: rendered } = await mermaid.render(id, chart)

        if (!cancelled) {
          setSvg(rendered)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram')
          setLoading(false)
        }
      }
    }

    renderMermaid()
    return () => {
      cancelled = true
    }
  }, [chart])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 border border-border rounded-lg bg-muted/30 my-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-xs text-muted-foreground">Rendering diagram...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border border-destructive/20 bg-destructive/5 rounded-lg p-3 my-2">
        <p className="text-xs text-destructive">Failed to render Mermaid diagram: {error}</p>
        <pre className="mt-2 text-xs font-mono text-muted-foreground overflow-x-auto">
          {chart}
        </pre>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="my-2 overflow-x-auto border border-border rounded-lg p-4 bg-background"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
