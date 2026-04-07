'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { FlaskConical, Plus, Play, Square, TrendingUp, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { adminFetch } from '@/lib/admin-api'

interface Experiment {
  id: string
  name: string
  description: string | null
  variants: {
    control?: { name: string; description?: string; [key: string]: any }
    test?: { name: string; description?: string; [key: string]: any }
    [key: string]: any
  }
  status: 'draft' | 'running' | 'completed'
  started_at: string | null
  ended_at: string | null
  created_at: string
  stats?: {
    control: {
      impressions: number
      clicks: number
      conversions: number
      revenue: number
    }
    test: {
      impressions: number
      clicks: number
      conversions: number
      revenue: number
    }
  }
}

// Helper to get the test variant (could be 'test', 'variant_a', etc.)
function getTestVariant(variants: any) {
  if (variants.test) return { key: 'test', data: variants.test }
  const keys = Object.keys(variants).filter(k => k !== 'control')
  if (keys.length > 0) return { key: keys[0], data: variants[keys[0]] }
  return null
}

export default function ABTestsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newExperiment, setNewExperiment] = useState({
    name: '',
    description: '',
    controlName: 'Control',
    controlDescription: '',
    testName: 'Variant A',
    testDescription: ''
  })
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchExperiments = async () => {
    setLoading(true)
    try {
      const response = await adminFetch('/api/ab-tests')
      if (!response.ok) throw new Error('Failed to fetch experiments')
      const data = await response.json()
      setExperiments(data)
    } catch (error) {
      console.error('Error fetching experiments:', error)
      toast.error('Failed to load experiments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExperiments()
  }, [])

  const handleCreate = async () => {
    if (!newExperiment.name.trim()) {
      toast.error('Experiment name is required')
      return
    }

    setCreating(true)
    try {
      const response = await adminFetch('/api/ab-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newExperiment.name,
          description: newExperiment.description || null,
          variants: {
            control: {
              name: newExperiment.controlName,
              description: newExperiment.controlDescription || undefined
            },
            test: {
              name: newExperiment.testName,
              description: newExperiment.testDescription || undefined
            }
          }
        })
      })

      if (!response.ok) throw new Error('Failed to create experiment')

      const created = await response.json()
      setExperiments(prev => [created, ...prev])
      toast.success('Experiment created successfully')
      setDialogOpen(false)
      setNewExperiment({
        name: '',
        description: '',
        controlName: 'Control',
        controlDescription: '',
        testName: 'Variant A',
        testDescription: ''
      })
    } catch (error) {
      console.error('Error creating experiment:', error)
      toast.error('Failed to create experiment')
    } finally {
      setCreating(false)
    }
  }

  const handleStatusChange = async (id: string, action: 'start' | 'stop') => {
    try {
      const response = await adminFetch(`/api/ab-tests/${id}/${action}`, {
        method: 'POST'
      })

      if (!response.ok) throw new Error(`Failed to ${action} experiment`)

      const updated = await response.json()
      setExperiments(prev => prev.map(exp => exp.id === id ? updated : exp))
      toast.success(`Experiment ${action === 'start' ? 'started' : 'stopped'} successfully`)
    } catch (error) {
      console.error(`Error ${action}ing experiment:`, error)
      toast.error(`Failed to ${action} experiment`)
    }
  }

  const getStatusBadge = (status: Experiment['status']) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="bg-muted text-muted-foreground">Draft</Badge>
      case 'running':
        return <Badge variant="outline" className="bg-success/10 text-success">Running</Badge>
      case 'completed':
        return <Badge variant="outline" className="bg-primary/10 text-primary">Completed</Badge>
    }
  }

  const calculateConversionRate = (conversions: number, impressions: number) => {
    if (impressions === 0) return '0.00'
    return ((conversions / impressions) * 100).toFixed(2)
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <span className="text-foreground">Admin</span>
        <span>&gt;</span>
        <span>A/B Tests</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <FlaskConical className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">A/B Testing</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Create and manage experiments to optimize conversions
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchExperiments}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Experiment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Experiment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="exp-name">Experiment Name *</Label>
                  <Input
                    id="exp-name"
                    value={newExperiment.name}
                    onChange={(e) => setNewExperiment(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Homepage Hero Button Color"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exp-desc">Description</Label>
                  <Textarea
                    id="exp-desc"
                    value={newExperiment.description}
                    onChange={(e) => setNewExperiment(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="What are you testing and why?"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-semibold">Control Variant</Label>
                    <Input
                      value={newExperiment.controlName}
                      onChange={(e) => setNewExperiment(prev => ({ ...prev, controlName: e.target.value }))}
                      placeholder="Control"
                    />
                    <Textarea
                      value={newExperiment.controlDescription}
                      onChange={(e) => setNewExperiment(prev => ({ ...prev, controlDescription: e.target.value }))}
                      placeholder="Describe the control variant"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold">Test Variant</Label>
                    <Input
                      value={newExperiment.testName}
                      onChange={(e) => setNewExperiment(prev => ({ ...prev, testName: e.target.value }))}
                      placeholder="Variant A"
                    />
                    <Textarea
                      value={newExperiment.testDescription}
                      onChange={(e) => setNewExperiment(prev => ({ ...prev, testDescription: e.target.value }))}
                      placeholder="Describe the test variant"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Experiment'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Experiment List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <div className="animate-pulse space-y-2">
                  <div className="h-6 bg-muted rounded w-1/3"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : experiments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No experiments yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first A/B test to start optimizing conversions
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Experiment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {experiments.map(exp => (
            <Card key={exp.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <CardTitle>{exp.name}</CardTitle>
                      {getStatusBadge(exp.status)}
                    </div>
                    {exp.description && (
                      <CardDescription>{exp.description}</CardDescription>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(exp.created_at).toLocaleDateString()}
                      {exp.started_at && ` • Started ${new Date(exp.started_at).toLocaleDateString()}`}
                      {exp.ended_at && ` • Ended ${new Date(exp.ended_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {exp.status === 'draft' && (
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange(exp.id, 'start')}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Start
                      </Button>
                    )}
                    {exp.status === 'running' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(exp.id, 'stop')}
                      >
                        <Square className="mr-2 h-4 w-4" />
                        Stop
                      </Button>
                    )}
                    {(exp.status === 'running' || exp.status === 'completed') && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                        title="Coming soon"
                      >
                        <TrendingUp className="mr-2 h-4 w-4" />
                        View Results
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Control Variant */}
                  {exp.variants.control && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        {exp.variants.control.name}
                        <Badge variant="outline" className="text-xs">Control</Badge>
                      </h4>
                      {exp.variants.control.description && (
                        <p className="text-sm text-muted-foreground">{exp.variants.control.description}</p>
                      )}
                    {exp.stats && (
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <div className="bg-muted rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">Impressions</p>
                            <p className="text-lg font-semibold">{exp.stats.control.impressions.toLocaleString()}</p>
                          </div>
                          <div className="bg-muted rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">Conversions</p>
                            <p className="text-lg font-semibold">{exp.stats.control.conversions.toLocaleString()}</p>
                          </div>
                          <div className="bg-muted rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">Conv. Rate</p>
                            <p className="text-lg font-semibold">
                              {calculateConversionRate(exp.stats.control.conversions, exp.stats.control.impressions)}%
                            </p>
                          </div>
                          <div className="bg-muted rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">Revenue</p>
                            <p className="text-lg font-semibold">€{(exp.stats.control.revenue / 100).toFixed(2)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Test Variant */}
                  {(() => {
                    const testVariant = getTestVariant(exp.variants)
                    if (!testVariant) return null

                    return (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          {testVariant.data.name || testVariant.key}
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary">Test</Badge>
                        </h4>
                        {testVariant.data.description && (
                          <p className="text-sm text-muted-foreground">{testVariant.data.description}</p>
                        )}
                        {exp.stats && (
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <div className="bg-muted rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">Impressions</p>
                              <p className="text-lg font-semibold">{exp.stats.test.impressions.toLocaleString()}</p>
                            </div>
                            <div className="bg-muted rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">Conversions</p>
                              <p className="text-lg font-semibold">{exp.stats.test.conversions.toLocaleString()}</p>
                            </div>
                            <div className="bg-muted rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">Conv. Rate</p>
                              <p className="text-lg font-semibold">
                                {calculateConversionRate(exp.stats.test.conversions, exp.stats.test.impressions)}%
                              </p>
                            </div>
                            <div className="bg-muted rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">Revenue</p>
                              <p className="text-lg font-semibold">€{(exp.stats.test.revenue / 100).toFixed(2)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
