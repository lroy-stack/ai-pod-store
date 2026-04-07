import { useMemo } from 'react'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = 'currentColor',
  className = ''
}: SparklineProps) {
  const points = useMemo(() => {
    if (data.length === 0) return ''

    const max = Math.max(...data, 0.01) // Avoid division by zero
    const min = Math.min(...data, 0)
    const range = max - min || 1

    const xStep = width / (data.length - 1 || 1)
    const yScale = height / range

    return data
      .map((value, index) => {
        const x = index * xStep
        const y = height - (value - min) * yScale
        return `${x},${y}`
      })
      .join(' ')
  }, [data, width, height])

  if (data.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={color}
          strokeOpacity="0.2"
          strokeWidth="1"
        />
      </svg>
    )
  }

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
