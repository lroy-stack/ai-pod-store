import { ReactNode } from 'react'

export default function EditorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh w-full overflow-hidden bg-background">
      {children}
    </div>
  )
}
