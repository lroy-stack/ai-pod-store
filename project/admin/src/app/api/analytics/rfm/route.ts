import { NextResponse } from 'next/server'

// NOTE: This endpoint returns mock RFM data for now
// In production, this will read from analytics_results table
// populated by Python RFM segmentation script (pandas)
// running daily at 2 AM UTC via APScheduler/cron

export async function GET() {
  try {
    // Mock RFM segments for demonstration
    // Real implementation will query from Supabase analytics_results table
    const rfmData = {
      segments: {
        champions: 3,      // High R, F, M
        loyal: 5,          // High F, M
        potential: 8,      // High R, low F
        atRisk: 2,         // Low R, high F, M
        hibernating: 4,    // Low R, F, M
        lost: 1            // Very low R
      },
      totalCustomers: 23,
      calculatedAt: new Date().toISOString(),
      source: 'mock'
    }

    return NextResponse.json(rfmData)
  } catch (error) {
    console.error('Error fetching RFM data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch RFM data' },
      { status: 500 }
    )
  }
}
