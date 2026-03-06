import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '@/lib/auth-middleware';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export const GET = withAuth(async (req, session) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get users created in the last 30 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const { data: users, error } = await supabase
      .from('users')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Customer acquisition error:', error);
      return NextResponse.json({ error: 'Failed to fetch customer acquisition' }, { status: 500 });
    }

    // Group by date
    const usersByDate: Record<string, number> = {};
    users?.forEach((user) => {
      const date = new Date(user.created_at).toISOString().split('T')[0];
      usersByDate[date] = (usersByDate[date] || 0) + 1;
    });

    // Fill in missing dates with 0
    const chartData: { date: string; customers: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      chartData.push({
        date: dateStr,
        customers: usersByDate[dateStr] || 0,
      });
    }

    return NextResponse.json(chartData);
  } catch (error) {
    console.error('Customer acquisition error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
