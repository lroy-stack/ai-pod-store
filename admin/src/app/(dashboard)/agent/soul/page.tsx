'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChevronLeft, Sparkles, Check, X, FileText, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { SafeMarkdown } from '@/components/ui/safe-markdown'
import { adminFetch } from '@/lib/admin-api'
import { toast } from 'sonner'

interface SoulProposal {
  id: string
  section: string
  current_content: string
  proposed_content: string
  reasoning: string
  requires_review: boolean
  created_at: string
  status: string
}

interface DiffLine {
  type: 'add' | 'remove' | 'context'
  content: string
}

export default function SoulEvolutionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [soulContent, setSoulContent] = useState<string>('')
  const [proposals, setProposals] = useState<SoulProposal[]>([])
  const [selectedProposal, setSelectedProposal] = useState<SoulProposal | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actionInProgress, setActionInProgress] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const res = await adminFetch('/api/admin/agent/soul')
      if (res.ok) {
        const data = await res.json()
        setSoulContent(data.soul || '# SOUL.md\n\nNo content.')
        setProposals(data.proposals || [])
      }
    } catch (error) {
      console.error('Failed to load soul data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(proposalId: string) {
    setActionInProgress(true)
    try {
      const res = await adminFetch('/api/admin/agent/soul', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          proposalId,
        }),
      })

      if (res.ok) {
        // Reload data to reflect changes
        await loadData()
        setSelectedProposal(null)
        setShowDiff(false)
      } else {
        const error = await res.json()
        toast.error(`Failed to approve proposal: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to approve proposal:', error)
      toast.error('Failed to approve proposal')
    } finally {
      setActionInProgress(false)
    }
  }

  async function handleReject(proposalId: string, reason: string) {
    setActionInProgress(true)
    try {
      const res = await adminFetch('/api/admin/agent/soul', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          proposalId,
          reason,
        }),
      })

      if (res.ok) {
        // Reload data to reflect changes
        await loadData()
        setSelectedProposal(null)
        setShowDiff(false)
        setShowRejectDialog(false)
        setRejectReason('')
      } else {
        const error = await res.json()
        toast.error(`Failed to reject proposal: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to reject proposal:', error)
      toast.error('Failed to reject proposal')
    } finally {
      setActionInProgress(false)
    }
  }

  function generateDiff(oldText: string, newText: string): DiffLine[] {
    const oldLines = oldText.split('\n')
    const newLines = newText.split('\n')
    const diff: DiffLine[] = []

    // Simple line-by-line diff (not a true LCS algorithm)
    const maxLines = Math.max(oldLines.length, newLines.length)

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i]
      const newLine = newLines[i]

      if (oldLine === newLine) {
        diff.push({ type: 'context', content: oldLine || '' })
      } else {
        if (oldLine !== undefined) {
          diff.push({ type: 'remove', content: oldLine })
        }
        if (newLine !== undefined) {
          diff.push({ type: 'add', content: newLine })
        }
      }
    }

    return diff
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <span className="text-foreground">Admin</span>
        <span>&gt;</span>
        <button onClick={() => router.push('/agent')} className="hover:text-foreground">
          Agent Monitor
        </button>
        <span>&gt;</span>
        <span>Soul Evolution</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/agent')}
              className="p-0 h-auto hover:bg-transparent"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold">Soul Evolution</h1>
          </div>
          <p className="text-muted-foreground">
            Review and approve PodClaw&apos;s proposed personality changes
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current SOUL.md */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Current SOUL.md
            </CardTitle>
            <CardDescription>
              PodClaw&apos;s active personality and behavioral guidelines
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] md:h-[600px]">
              {loading ? (
                <div className="space-y-3">
                  <div className="h-6 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-4 bg-muted animate-pulse rounded w-full" />
                  <div className="h-4 bg-muted animate-pulse rounded w-5/6" />
                  <div className="h-4 bg-muted animate-pulse rounded w-full" />
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <SafeMarkdown>
                    {soulContent}
                  </SafeMarkdown>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Pending Proposals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Pending Proposals
              {proposals.length > 0 && (
                <Badge variant="secondary">{proposals.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Changes proposed by PodClaw awaiting review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] md:h-[600px]">
              {loading ? (
                <div className="space-y-3">
                  <div className="h-24 bg-muted animate-pulse rounded" />
                  <div className="h-24 bg-muted animate-pulse rounded" />
                  <div className="h-24 bg-muted animate-pulse rounded" />
                </div>
              ) : proposals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    No pending proposals
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PodClaw has not proposed any changes to its soul
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {proposals.map((proposal) => (
                    <Card key={proposal.id} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <CardTitle className="text-base">
                              {proposal.section}
                            </CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {new Date(proposal.created_at).toLocaleDateString()} at{' '}
                              {new Date(proposal.created_at).toLocaleTimeString()}
                            </CardDescription>
                          </div>
                          {proposal.requires_review && (
                            <Badge variant="destructive" className="text-xs">
                              Needs Review
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-1">Reasoning:</p>
                          <p className="text-sm text-muted-foreground">
                            {proposal.reasoning}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedProposal(proposal)
                              setShowDiff(true)
                            }}
                          >
                            View Diff
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(proposal.id)}
                            disabled={actionInProgress}
                            className="bg-success hover:bg-success/90"
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedProposal(proposal)
                              setShowRejectDialog(true)
                            }}
                            disabled={actionInProgress}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Diff Dialog */}
      <Dialog open={showDiff} onOpenChange={setShowDiff}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedProposal?.section} — Proposed Changes
            </DialogTitle>
            <DialogDescription>
              Compare current and proposed content
            </DialogDescription>
          </DialogHeader>

          {selectedProposal && (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {/* Reasoning */}
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Reasoning:</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedProposal.reasoning}
                  </p>
                </div>

                {/* Diff View */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 border-b">
                    <p className="text-sm font-medium">Changes</p>
                  </div>
                  <div className="font-mono text-xs">
                    {generateDiff(
                      selectedProposal.current_content,
                      selectedProposal.proposed_content
                    ).map((line, idx) => (
                      <div
                        key={idx}
                        className={
                          line.type === 'add'
                            ? 'bg-success/10 text-success px-4 py-0.5'
                            : line.type === 'remove'
                            ? 'bg-destructive/10 text-destructive px-4 py-0.5'
                            : 'px-4 py-0.5'
                        }
                      >
                        <span className="select-none mr-2">
                          {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                        </span>
                        {line.content || '\u00A0'}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDiff(false)}>
              Close
            </Button>
            {selectedProposal && (
              <>
                <Button
                  variant="default"
                  onClick={() => {
                    handleApprove(selectedProposal.id)
                  }}
                  disabled={actionInProgress}
                  className="bg-success hover:bg-success/90"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowDiff(false)
                    setShowRejectDialog(true)
                  }}
                  disabled={actionInProgress}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Proposal</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this soul evolution proposal (optional)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">
                Section: {selectedProposal?.section}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedProposal?.reasoning}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Rejection Reason (optional)</label>
              <Textarea
                placeholder="Explain why this proposal is being rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-2"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false)
                setRejectReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedProposal) {
                  handleReject(selectedProposal.id, rejectReason)
                }
              }}
              disabled={actionInProgress}
            >
              <X className="h-4 w-4 mr-1" />
              Reject Proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
