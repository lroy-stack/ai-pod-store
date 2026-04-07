'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Brain, Eye } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface AgentMemoryDialogProps {
  content: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onFetchMemory: () => void
}

export function AgentMemoryDialog({ content, open, onOpenChange, onFetchMemory }: AgentMemoryDialogProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Agent Memory
          </CardTitle>
          <CardDescription>
            View PodClaw&apos;s SOUL.md identity and long-term memory
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onFetchMemory} variant="outline" size="sm">
            <Eye className="mr-2 h-4 w-4" />
            View SOUL.md
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agent Identity (SOUL.md)</DialogTitle>
            <DialogDescription>
              PodClaw&apos;s core identity and behavioral guidelines
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 p-4 mt-4">
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {content || 'Loading...'}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
