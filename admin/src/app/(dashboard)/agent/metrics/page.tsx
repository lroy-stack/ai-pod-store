'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, DollarSign, Zap, Calendar, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/admin-api'

interface AgentMetrics {
  agent_name: string
  last_run_at: string | null
  today_cost: number
  success_rate: number
  cost_history: Array<{ date: string; cost: number }>
  total_runs: number
  running: boolean
}

interface ChartDataPoint {
  date: string
  cost: number
  tokens: number
  [key: string]: string | number // For per-agent costs
}

// Agent color palette
const AGENT_COLORS: { [key: string]: string } = {
  'cataloger': 'hsl(var(--chart-1))',
  'brand_manager': 'hsl(var(--chart-2))',
  'design_creator': 'hsl(var(--chart-3))',
  'product_strategist': 'hsl(var(--chart-4))',
  'market_researcher': 'hsl(var(--chart-5))',
  'customer_insights': 'hsl(142, 76%, 36%)', // Green
  'fulfillment_monitor': 'hsl(221, 83%, 53%)', // Blue
  'finance_analyst': 'hsl(262, 83%, 58%)', // Purple
  'support_agent': 'hsl(24, 95%, 53%)' // Orange
}

export default function AgentMetricsPage() {
  const router = useRouter()
  const [metrics, setMetrics] = useState<AgentMetrics[]>([])
  const [availableAgents, setAvailableAgents] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string>('all')
  const [dateRange, setDateRange] = useState<'7d' | '30d'>('7d')

  useEffect(() => {
    fetchMetrics()
  }, [selectedAgent, dateRange])

  async function fetchMetrics() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedAgent !== 'all') {
        params.set('agent', selectedAgent)
      }
      params.set('range', dateRange)

      const res = await adminFetch(`/api/agent/metrics?${params.toString()}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!res.ok) {
        console.error('API error:', res.status, res.statusText)
        return
      }

      const data = await res.json()
      setMetrics(data)

      // Extract unique agent names from response (only when showing all agents)
      if (selectedAgent === 'all' && data.length > 0) {
        const agents = data.map((m: AgentMetrics) => m.agent_name).filter(Boolean)
        setAvailableAgents(agents)
      }
    } catch (error) {
      console.error('Failed to fetch agent metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  // Prepare chart data for stacked bar chart and line charts
  const chartData: ChartDataPoint[] = []
  if (metrics.length > 0) {
    // Get all unique dates from all agents
    const allDates = new Set<string>()
    metrics.forEach(m => {
      m.cost_history.forEach(h => allDates.add(h.date))
    })

    // Sort dates
    const sortedDates = Array.from(allDates).sort()

    // For each date, create data point with per-agent costs
    sortedDates.forEach(date => {
      const dataPoint: ChartDataPoint = {
        date: formatDate(date),
        cost: 0,
        tokens: 0
      }

      // Add cost for each agent
      let totalCost = 0
      metrics.forEach(agent => {
        const dayCost = agent.cost_history.find(h => h.date === date)
        const cost = dayCost?.cost || 0
        dataPoint[agent.agent_name] = parseFloat(cost.toFixed(4))
        totalCost += cost
      })

      // Set total cost and estimated tokens
      dataPoint.cost = parseFloat(totalCost.toFixed(4))
      // Estimate tokens from cost (rough approximation: $0.003/1K input tokens for Sonnet)
      dataPoint.tokens = Math.round((totalCost / 0.003) * 1000)

      chartData.push(dataPoint)
    })
  }

  // Calculate summary stats
  const totalCost = metrics.reduce((sum, m) => sum + m.today_cost, 0)
  const avgSuccessRate = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.success_rate, 0) / metrics.length)
    : 0
  const totalRuns = metrics.reduce((sum, m) => sum + m.total_runs, 0)

  // Calculate monthly total (sum of all daily costs in the period)
  const monthlyTotal = chartData.reduce((sum, point) => sum + point.cost, 0)

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
        <span>Metrics</span>
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
            <h1 className="text-3xl font-bold">Agent Metrics</h1>
          </div>
          <p className="text-muted-foreground">
            Detailed cost and performance analytics per agent
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {/* Agent Filter */}
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {availableAgents.map(agent => (
                <SelectItem key={agent} value={agent}>
                  {agent}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range Tabs */}
          <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as '7d' | '30d')}>
            <TabsList>
              <TabsTrigger value="7d">7 Days</TabsTrigger>
              <TabsTrigger value="30d">30 Days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Today's Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCost.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedAgent === 'all' ? 'All agents' : selectedAgent}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Period Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${monthlyTotal.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {dateRange === '7d' ? 'Last 7 days' : 'Last 30 days'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Average Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgSuccessRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalRuns} total runs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              Data Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{chartData.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {dateRange === '7d' ? '7 days' : '30 days'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {loading ? (
        <div className="grid gap-4 grid-cols-1">
          <div className="h-[400px] animate-pulse rounded-lg bg-muted" />
          <div className="h-[400px] animate-pulse rounded-lg bg-muted" />
          <div className="h-[400px] animate-pulse rounded-lg bg-muted" />
        </div>
      ) : chartData.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No metrics data</p>
            <p className="text-sm text-muted-foreground mt-1">
              Agent metrics will appear after agents have run
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1">
          {/* Stacked Bar Chart - Daily Cost per Agent */}
          {selectedAgent === 'all' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Daily Cost Breakdown by Agent
                </CardTitle>
                <CardDescription>
                  Stacked view showing cost contribution per agent over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] md:h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        tickFormatter={(value) => `$${value.toFixed(3)}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px'
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: number) => `$${value.toFixed(4)}`}
                      />
                      <Legend />
                      {metrics.map((agent, index) => (
                        <Bar
                          key={agent.agent_name}
                          dataKey={agent.agent_name}
                          stackId="costs"
                          fill={AGENT_COLORS[agent.agent_name] || `hsl(${(index * 360) / metrics.length}, 70%, 50%)`}
                          name={agent.agent_name}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cost Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Cost Over Time
              </CardTitle>
              <CardDescription>
                Daily cost in USD for {selectedAgent === 'all' ? 'all agents combined' : selectedAgent}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] md:h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      tickFormatter={(value) => `$${value.toFixed(3)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="cost"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      name="Daily Cost"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Token Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Token Usage Over Time (Estimated)
              </CardTitle>
              <CardDescription>
                Estimated token consumption based on cost (approximate)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] md:h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      tickFormatter={(value) => formatTokens(value)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [formatTokens(value), 'Tokens']}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="tokens"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      name="Estimated Tokens"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// Helper to format date (MM/DD)
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// Helper to format token counts
function formatTokens(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return value.toString()
}
