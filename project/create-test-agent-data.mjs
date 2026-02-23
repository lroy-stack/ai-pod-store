import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function createTestData() {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  
  // Create agent sessions for different agents
  const sessions = [
    {
      session_type: 'cataloger',
      status: 'completed',
      started_at: new Date(now.getTime() - 3600000).toISOString(),
      ended_at: new Date(now.getTime() - 1800000).toISOString(),
      tool_calls: 25,
      tool_errors: 1
    },
    {
      session_type: 'cataloger',
      status: 'completed',
      started_at: new Date(now.getTime() - 7200000).toISOString(),
      ended_at: new Date(now.getTime() - 5400000).toISOString(),
      tool_calls: 30,
      tool_errors: 0
    },
    {
      session_type: 'designer',
      status: 'completed',
      started_at: new Date(now.getTime() - 10800000).toISOString(),
      ended_at: new Date(now.getTime() - 9000000).toISOString(),
      tool_calls: 15,
      tool_errors: 2
    },
    {
      session_type: 'seo_manager',
      status: 'error',
      started_at: new Date(now.getTime() - 14400000).toISOString(),
      ended_at: new Date(now.getTime() - 12600000).toISOString(),
      tool_calls: 10,
      tool_errors: 5
    },
    {
      session_type: 'customer_manager',
      status: 'completed',
      started_at: new Date(now.getTime() - 18000000).toISOString(),
      ended_at: new Date(now.getTime() - 16200000).toISOString(),
      tool_calls: 20,
      tool_errors: 0
    }
  ]

  console.log('Inserting agent sessions...')
  const { data: sessionData, error: sessionError } = await supabase
    .from('agent_sessions')
    .insert(sessions)
    .select()

  if (sessionError) {
    console.error('Session insert error:', sessionError)
  } else {
    console.log('Created', sessionData.length, 'agent sessions')
  }

  // Create daily costs for last 7 days
  const costs = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    costs.push(
      { agent_name: 'cataloger', date, total_cost: 0.05 + Math.random() * 0.1 },
      { agent_name: 'designer', date, total_cost: 0.08 + Math.random() * 0.15 },
      { agent_name: 'seo_manager', date, total_cost: 0.03 + Math.random() * 0.05 },
      { agent_name: 'customer_manager', date, total_cost: 0.02 + Math.random() * 0.04 }
    )
  }

  console.log('Inserting daily costs...')
  const { data: costData, error: costError } = await supabase
    .from('agent_daily_costs')
    .upsert(costs, { onConflict: 'agent_name,date' })
    .select()

  if (costError) {
    console.error('Cost insert error:', costError)
  } else {
    console.log('Created', costData.length, 'daily cost records')
  }

  console.log('Test data created successfully!')
}

createTestData()
