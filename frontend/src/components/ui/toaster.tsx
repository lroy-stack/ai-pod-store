'use client'

import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      theme="system"
      position="bottom-right"
      closeButton
      toastOptions={{
        duration: 3000,
        classNames: {
          toast: 'font-sans border-border shadow-lg backdrop-blur-sm',
          title: 'font-heading font-semibold text-sm',
          description: 'text-muted-foreground text-xs',
          success: 'bg-card border-success/20 text-foreground',
          error: 'bg-card border-destructive/20 text-foreground',
          warning: 'bg-card border-warning/20 text-foreground',
          info: 'bg-card border-primary/20 text-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
          closeButton: 'text-muted-foreground hover:text-foreground',
        },
      }}
    />
  )
}
