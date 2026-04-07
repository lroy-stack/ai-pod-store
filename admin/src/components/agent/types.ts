export interface BridgeAgent {
  agent: string
  running: boolean
  session_id: string | null
  model: string | null
  tools: string[]
}

export interface BridgeStatus {
  running: boolean
  active_sessions: Record<string, string>
  agent_count: number
  agents: string[]
}

export interface AgentMetrics {
  agent_name: string
  last_run_at: string | null
  today_cost: number
  success_rate: number
  cost_history: Array<{ date: string; cost: number }>
  total_runs: number
  running: boolean
}

export interface AgentSession {
  id: string
  session_number: number | null
  session_type: string
  status: 'running' | 'completed' | 'error'
  started_at: string
  ended_at: string | null
  features_before: number | null
  features_after: number | null
  tool_calls: number
  tool_errors: number
}

export interface HealthCheck {
  ok: boolean
  [key: string]: any
}

export interface HealthStatus {
  status: 'ok' | 'degraded'
  checks: {
    orchestrator: HealthCheck
    heartbeat: HealthCheck
    supabase: HealthCheck
    scheduler: HealthCheck
    event_queue: HealthCheck
  }
}
