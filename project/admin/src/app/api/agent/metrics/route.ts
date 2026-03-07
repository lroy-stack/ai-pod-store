import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withAuth } from '@/lib/auth-middleware'
import type { SessionData } from '@/lib/session'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

interface AgentMetrics {
  agent_name: string
  last_run_at: string | null
  today_cost: number
  success_rate: number
  cost_history: Array<{ date: string; cost: number }>
  total_runs: number
  running: boolean
}

export const GET = withAuth(async (req: NextRequest, session: SessionData) => {
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Parse query parameters
    const { searchParams } = new URL(req.url)
    const agentFilter = searchParams.get('agent') // specific agent or null for all
    const rangeParam = searchParams.get('range') || '7d' // 7d or 30d

    // Get list of all agent types from database (dynamically)
    // Query unique agent names from agent_daily_costs and agent_sessions
    const { data: costAgents } = await supabase
      .from('agent_daily_costs')
      .select('agent_name')

    const { data: sessionAgents } = await supabase
      .from('agent_sessions')
      .select('session_type')

    // Combine and deduplicate
    const costAgentNames = costAgents?.map(a => a.agent_name) || []
    const sessionAgentTypes = sessionAgents?.map(a => a.session_type) || []
    const allAgentTypes = [...new Set([...costAgentNames, ...sessionAgentTypes])].filter(Boolean)

    // Filter to specific agent if requested
    const agentTypes = agentFilter
      ? allAgentTypes.filter(a => a === agentFilter)
      : allAgentTypes

    // Calculate date range
    const daysBack = rangeParam === '30d' ? 30 : 7
    const today = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const metrics: AgentMetrics[] = []

    for (const agentType of agentTypes) {
      // Get last run time and running status
      const { data: lastSession } = await supabase
        .from('agent_sessions')
        .select('ended_at, status, started_at')
        .eq('session_type', agentType)
        .order('started_at', { ascending: false })
        .limit(1)
        .single()

      // Get total runs and success rate
      const { data: sessions } = await supabase
        .from('agent_sessions')
        .select('status')
        .eq('session_type', agentType)

      const totalRuns = sessions?.length ?? 0
      const successfulRuns = sessions?.filter(s => s.status === 'completed').length ?? 0
      const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0

      // Get today's cost
      const { data: todayCost } = await supabase
        .from('agent_daily_costs')
        .select('total_cost')
        .eq('agent_name', agentType)
        .eq('date', today)
        .single()

      // Get cost history for the requested date range
      const { data: costHistory } = await supabase
        .from('agent_daily_costs')
        .select('date, total_cost')
        .eq('agent_name', agentType)
        .gte('date', startDate)
        .lte('date', today)
        .order('date', { ascending: true })

      // Fill missing days with zero cost
      const history: Array<{ date: string; cost: number }> = []
      for (let i = daysBack - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0]
        const dayCost = costHistory?.find(c => c.date === date)
        history.push({
          date,
          cost: dayCost?.total_cost ? parseFloat(dayCost.total_cost) : 0
        })
      }

      metrics.push({
        agent_name: agentType,
        last_run_at: lastSession?.ended_at || lastSession?.started_at || null,
        today_cost: todayCost?.total_cost ? parseFloat(todayCost.total_cost) : 0,
        success_rate: Math.round(successRate),
        cost_history: history,
        total_runs: totalRuns,
        running: lastSession?.status === 'running'
      })
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching agent metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agent metrics' },
      { status: 500 }
    )
  }
})
