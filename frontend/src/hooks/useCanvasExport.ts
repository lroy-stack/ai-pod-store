/**
 * Hook for exporting canvas state as PNG or JSON.
 * Wraps the CanvasHandle imperative methods in a convenient hook.
 */

import { useCallback } from 'react'
import type { CanvasHandle } from '@/components/design-studio/CanvasWorkspace'

export function useCanvasExport(canvasRef: React.RefObject<CanvasHandle | null>) {
  const exportPNG = useCallback((multiplier = 2): string => {
    return canvasRef.current?.exportPNG(multiplier) ?? ''
  }, [canvasRef])

  const exportJSON = useCallback((): object => {
    return canvasRef.current?.exportJSON() ?? {}
  }, [canvasRef])

  return { exportPNG, exportJSON }
}
