/**
 * Arc path computation helpers for curved text rendering.
 * Used by CurvedText class to position characters along a circular arc.
 */

export interface CharPosition {
  x: number
  y: number
  rotation: number // degrees
}

/**
 * Generate character positions along a circular arc.
 * @param charWidths - Array of individual character widths (in px)
 * @param angleInDegrees - Total arc angle (positive = curve up, negative = curve down)
 * @param direction - 'up' renders text along top of arc, 'down' along bottom
 * @returns Array of { x, y, rotation } per character
 */
export function generateArcPath(
  charWidths: number[],
  angleInDegrees: number,
  direction: 'up' | 'down' = 'up'
): CharPosition[] {
  if (charWidths.length === 0 || angleInDegrees === 0) return []

  const totalWidth = charWidths.reduce((a, b) => a + b, 0)
  const absAngle = Math.abs(angleInDegrees)
  const angleRad = (absAngle * Math.PI) / 180

  // Compute radius: arc length = radius * angle
  const radius = totalWidth / angleRad

  // Distribute characters evenly across the arc
  const startAngle = -angleRad / 2
  const positions: CharPosition[] = []

  let accumulatedWidth = 0

  for (let i = 0; i < charWidths.length; i++) {
    // Center of this character along the arc
    const charCenter = accumulatedWidth + charWidths[i] / 2
    const charFraction = charCenter / totalWidth
    const charAngle = startAngle + charFraction * angleRad

    let x: number, y: number, rotDeg: number

    if (direction === 'up') {
      // Text curves upward (like a smile upside down)
      x = radius * Math.sin(charAngle)
      y = -(radius * Math.cos(charAngle) - radius)
      rotDeg = (charAngle * 180) / Math.PI
    } else {
      // Text curves downward (like a smile)
      x = radius * Math.sin(charAngle)
      y = radius * Math.cos(charAngle) - radius
      rotDeg = -(charAngle * 180) / Math.PI
    }

    // Flip for negative angles
    if (angleInDegrees < 0) {
      y = -y
      rotDeg = -rotDeg
    }

    positions.push({ x, y, rotation: rotDeg })
    accumulatedWidth += charWidths[i]
  }

  return positions
}

/**
 * Measure curved text bounding box dimensions.
 * @returns { width, height } of the bounding box containing the curved text
 */
export function measureCurvedTextBounds(
  charWidths: number[],
  fontSize: number,
  angleInDegrees: number,
  direction: 'up' | 'down' = 'up'
): { width: number; height: number } {
  const positions = generateArcPath(charWidths, angleInDegrees, direction)
  if (positions.length === 0) return { width: 0, height: 0 }

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  for (const pos of positions) {
    // Approximate character bounds at position
    const halfChar = fontSize / 2
    minX = Math.min(minX, pos.x - halfChar)
    maxX = Math.max(maxX, pos.x + halfChar)
    minY = Math.min(minY, pos.y - halfChar)
    maxY = Math.max(maxY, pos.y + halfChar)
  }

  return {
    width: maxX - minX,
    height: maxY - minY,
  }
}
