import { NextResponse } from 'next/server'

// NOTE: This endpoint returns mock demand forecast data for now
// In production, this will read from analytics_results table
// populated by Python demand forecasting script (prophet)
// running daily at 2:30 AM UTC via APScheduler/cron

export async function GET() {
  try {
    // Mock demand forecast for demonstration
    // Real implementation will query from Supabase analytics_results table
    const demandData = {
      historical: [
        { week: '2026-W01', orders: 45, revenue: 1890 },
        { week: '2026-W02', orders: 52, revenue: 2145 },
        { week: '2026-W03', orders: 48, revenue: 1998 },
        { week: '2026-W04', orders: 61, revenue: 2567 },
        { week: '2026-W05', orders: 58, revenue: 2401 },
        { week: '2026-W06', orders: 64, revenue: 2689 },
      ],
      forecast: [
        {
          week: '2026-W07',
          ordersLower: 52,
          ordersForecast: 65,
          ordersUpper: 78,
          revenueForecast: 2730
        },
        {
          week: '2026-W08',
          ordersLower: 54,
          ordersForecast: 67,
          ordersUpper: 80,
          revenueForecast: 2814
        },
        {
          week: '2026-W09',
          ordersLower: 55,
          ordersForecast: 69,
          ordersUpper: 83,
          revenueForecast: 2898
        },
        {
          week: '2026-W10',
          ordersLower: 57,
          ordersForecast: 71,
          ordersUpper: 85,
          revenueForecast: 2982
        }
      ],
      summary: {
        avgWeeklyOrders: 60,
        avgWeeklyRevenue: 2515,
        trend: 'growing',
        trendValue: 2.8
      },
      calculatedAt: new Date().toISOString(),
      source: 'mock'
    }

    return NextResponse.json(demandData)
  } catch (error) {
    console.error('Error fetching demand data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch demand data' },
      { status: 500 }
    )
  }
}
