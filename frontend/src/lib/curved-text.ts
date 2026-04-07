/**
 * CurvedText — Custom Fabric.js v6 class for rendering text along a circular arc.
 *
 * Extends FabricObject and renders characters individually along an arc path.
 * Registered with classRegistry for JSON serialization/deserialization.
 */

import { generateArcPath, measureCurvedTextBounds } from './arc-path-helpers'

// Lazily resolved Fabric references — avoids importing at module scope (SSR-safe)
let FabricObject: any = null
let classRegistry: any = null

async function ensureFabric() {
  if (FabricObject) return
  const fabric = await import('fabric')
  FabricObject = fabric.FabricObject
  classRegistry = fabric.classRegistry
}

export interface CurvedTextOptions {
  text?: string
  fontSize?: number
  fontFamily?: string
  fill?: string | object
  curveAngle?: number
  curveDirection?: 'up' | 'down'
  letterSpacing?: number
  left?: number
  top?: number
}

/**
 * Create and register the CurvedText class.
 * Must be called after Fabric.js is loaded (client-side only).
 */
export async function registerCurvedText() {
  await ensureFabric()

  // Only register once
  try {
    if (classRegistry.getClass('CurvedText')) return
  } catch {
    // Not registered yet — continue
  }

  class CurvedText extends FabricObject {
    static type = 'CurvedText'

    declare text: string
    declare fontSize: number
    declare fontFamily: string
    declare curveAngle: number
    declare curveDirection: 'up' | 'down'
    declare letterSpacing: number

    constructor(options: CurvedTextOptions = {}) {
      super(options)
      this.text = options.text || 'Curved Text'
      this.fontSize = options.fontSize || 40
      this.fontFamily = options.fontFamily || 'Inter'
      this.fill = options.fill || '#000000'
      this.curveAngle = options.curveAngle || 180
      this.curveDirection = options.curveDirection || 'up'
      this.letterSpacing = options.letterSpacing || 0
      this._updateDimensions()
    }

    /** Measure each character and update object dimensions */
    _updateDimensions() {
      const charWidths = this._measureCharWidths()
      const bounds = measureCurvedTextBounds(
        charWidths,
        this.fontSize,
        this.curveAngle,
        this.curveDirection
      )
      this.width = Math.max(bounds.width, 10)
      this.height = Math.max(bounds.height, 10)
    }

    _measureCharWidths(): number[] {
      // Use an offscreen canvas to measure character widths
      if (typeof document === 'undefined') {
        // SSR fallback — rough estimate
        return this.text.split('').map(() => this.fontSize * 0.6)
      }
      const ctx = document.createElement('canvas').getContext('2d')!
      ctx.font = `${this.fontSize}px "${this.fontFamily}"`
      return this.text.split('').map(char => {
        const m = ctx.measureText(char)
        return m.width + this.letterSpacing
      })
    }

    _render(ctx: CanvasRenderingContext2D) {
      const charWidths = this._measureCharWidths()
      const positions = generateArcPath(charWidths, this.curveAngle, this.curveDirection)

      ctx.font = `${this.fontSize}px "${this.fontFamily}"`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Apply fill — handle gradient object or string
      if (typeof this.fill === 'string') {
        ctx.fillStyle = this.fill
      } else {
        ctx.fillStyle = '#000000'
      }

      // Apply stroke if present
      if (this.stroke && this.strokeWidth) {
        ctx.strokeStyle = this.stroke as string
        ctx.lineWidth = this.strokeWidth
      }

      const chars = this.text.split('')
      for (let i = 0; i < chars.length; i++) {
        const pos = positions[i]
        if (!pos) continue
        ctx.save()
        ctx.translate(pos.x, pos.y)
        ctx.rotate((pos.rotation * Math.PI) / 180)
        if (this.stroke && this.strokeWidth && (this as any).paintFirst === 'stroke') {
          ctx.strokeText(chars[i], 0, 0)
        }
        ctx.fillText(chars[i], 0, 0)
        if (this.stroke && this.strokeWidth && (this as any).paintFirst !== 'stroke') {
          ctx.strokeText(chars[i], 0, 0)
        }
        ctx.restore()
      }
    }

    toObject(propertiesToInclude?: string[]) {
      return {
        ...super.toObject(propertiesToInclude),
        text: this.text,
        fontSize: this.fontSize,
        fontFamily: this.fontFamily,
        curveAngle: this.curveAngle,
        curveDirection: this.curveDirection,
        letterSpacing: this.letterSpacing,
      }
    }

    static fromObject(object: any): Promise<any> {
      return Promise.resolve(new CurvedText(object))
    }
  }

  classRegistry.setClass(CurvedText, 'CurvedText')
}

/**
 * Create a CurvedText instance.
 * Ensure registerCurvedText() has been called first.
 */
export async function createCurvedText(options: CurvedTextOptions = {}) {
  await ensureFabric()
  const CurvedTextClass = classRegistry.getClass('CurvedText')
  if (!CurvedTextClass) {
    throw new Error('CurvedText not registered. Call registerCurvedText() first.')
  }
  return new CurvedTextClass(options)
}
