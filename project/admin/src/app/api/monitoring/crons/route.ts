import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { supabaseAdmin } from '@/lib/supabase';

// The 5 expected cron jobs
const KNOWN_CRONS = [
  { name: 'sync-pod', label: 'Printful Sync', description: 'Syncs products with Printful' },
  { name: 'abandoned-cart', label: 'Abandoned Cart', description: 'Sends abandoned cart emails' },
  { name: 'drip', label: 'Drip Campaign', description: 'Sends drip marketing emails' },
  { name: 'cleanup', label: 'Cleanup', description: 'Cleans up old data and temp files' },
  { name: 'retry-orders', label: 'Retry Orders', description: 'Retries failed orders' },
];

/**
 * GET /api/monitoring/crons
 * Returns cron job status from cron_runs table
 */
export const GET = withAuth(async () => {
  try {
    // Get the most recent run for each known cron
    const { data: runs, error } = await supabaseAdmin
      .from('cron_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[monitoring/crons]', error);
      return NextResponse.json({ error: 'Failed to fetch cron runs' }, { status: 500 });
    }

    // Group runs by cron_name, take most recent
    const latestByName = new Map<string, typeof runs[0]>();
    for (const run of (runs || [])) {
      if (!latestByName.has(run.cron_name)) {
        latestByName.set(run.cron_name, run);
      }
    }

    const cronJobs = KNOWN_CRONS.map((cron) => {
      const latest = latestByName.get(cron.name);
      return {
        name: cron.name,
        label: cron.label,
        description: cron.description,
        lastRun: latest?.started_at || null,
        finishedAt: latest?.finished_at || null,
        status: latest?.status || 'never_run',
        durationMs: latest?.duration_ms || null,
        errorMessage: latest?.error_message || null,
        rowsAffected: latest?.rows_affected || null,
      };
    });

    // Also get recent runs for history (last 50 across all crons)
    const recentRuns = (runs || []).slice(0, 50).map((run) => ({
      id: run.id,
      cronName: run.cron_name,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      status: run.status,
      durationMs: run.duration_ms,
      errorMessage: run.error_message,
      rowsAffected: run.rows_affected,
    }));

    return NextResponse.json({ cronJobs, recentRuns });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
});
