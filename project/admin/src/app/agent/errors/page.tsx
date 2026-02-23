'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, WifiOff, ArrowLeft } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { adminFetch } from '@/lib/admin-api'

interface AgentError {
  id: string
  agent_name: string
  event_type: string
  payload: {
    error?: string
    message?: string
    [key: string]: any
  }
  session_id: string | null
  created_at: string
}

export default function AgentErrorsPage() {
  const router = useRouter()
  const [errors, setErrors] = useState<AgentError[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    fetchErrors()
  }, [])

  async function fetchErrors() {
    setLoading(true)
    setOffline(false)
    try {
      const res = await adminFetch('/api/agent/events?event_type=error&limit=100')

      if (res.status === 503) {
        setOffline(true)
        return
      }

      if (res.ok) {
        const data = await res.json()
        setErrors(data.events ?? [])
      }
    } catch {
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (offline) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span className="text-foreground">Admin</span>
          <span>&gt;</span>
          <span>Agent Monitor</span>
          <span>&gt;</span>
          <span>Errors</span>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
            <Badge variant="outline" className="bg-destructive/10 text-destructive mb-4">
              PodClaw Offline
            </Badge>
            <p className="text-lg font-medium">PodClaw bridge is not reachable</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start PodClaw to view agent error logs
            </p>
            <Button onClick={fetchErrors} variant="outline" className="mt-4">
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <span className="text-foreground">Admin</span>
        <span>&gt;</span>
        <button
          onClick={() => router.push('/agent')}
          className="hover:text-foreground transition-colors"
        >
          Agent Monitor
        </button>
        <span>&gt;</span>
        <span>Errors</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-3xl font-bold">Agent Error Log</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Recent errors from PodClaw agents
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push('/agent')} variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={fetchErrors} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error List */}
      <Card>
        <CardHeader>
          <CardTitle>Errors ({errors.length})</CardTitle>
          <CardDescription>
            Showing recent errors from bridge /events?event_type=error
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No errors logged</p>
              <p className="text-sm text-muted-foreground mt-1">
                Agent errors will appear here when they occur
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {errors.map((error) => (
                <div
                  key={error.id}
                  className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-destructive/10 text-destructive">
                        {error.agent_name}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {error.event_type}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(error.created_at), 'MMM d, yyyy HH:mm:ss')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(error.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {/* Error Message */}
                  <div className="rounded-md bg-background p-3">
                    <p className="text-sm font-medium text-destructive">
                      {error.payload.error || error.payload.message || 'Unknown error'}
                    </p>
                  </div>

                  {/* Session ID */}
                  {error.session_id && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Session:</span>
                      <code className="bg-background px-1 py-0.5 rounded text-xs">
                        {error.session_id}
                      </code>
                    </div>
                  )}

                  {/* Additional Payload */}
                  {Object.keys(error.payload).filter(k => k !== 'error' && k !== 'message').length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Show details
                      </summary>
                      <pre className="mt-2 rounded-md bg-background p-2 text-xs text-muted-foreground overflow-x-auto">
                        {JSON.stringify(error.payload, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
