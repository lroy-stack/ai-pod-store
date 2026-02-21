'use client'

import dynamic from 'next/dynamic'

const MetaballsBackground = dynamic(
  () => import('@/components/landing/MetaballsBackground').then(m => ({ default: m.MetaballsBackground })),
  { ssr: false }
)

export function AuthBackground() {
  return (
    <>
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <MetaballsBackground />
      </div>
      <div className="fixed inset-x-0 bottom-0 h-40 shader-fade-bottom pointer-events-none z-0" aria-hidden="true" />
    </>
  )
}
