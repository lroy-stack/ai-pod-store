/**
 * Agent Schedule API — Admin
 * GET: Retrieve full schedule configuration
 * PUT: Update agent schedules
 * POST: Reset schedule to defaults
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

const PODCLAW_BRIDGE_URL = process.env.PODCLAW_BRIDGE_URL || 'http://localhost:8000';

async function checkAdminAuth(): Promise<NextResponse | null> {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.isLoggedIn) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    return null; // Auth successful
  } catch {
    return NextResponse.json(
      { error: 'Invalid session' },
      { status: 401 }
    );
  }
}

/**
 * GET /api/agent/schedule
 * Returns full schedule configuration with job status and next run times
 */
export async function GET() {
  const authError = await checkAdminAuth();
  if (authError) return authError;

  try {
    const response = await fetch(`${PODCLAW_BRIDGE_URL}/schedule`, {
      headers: {
        'Authorization': `Bearer ${process.env.PODCLAW_BRIDGE_AUTH_TOKEN}`,
      },
    });

    // Handle PodClaw offline
    if (!response.ok) {
      if (response.status === 503 || response.status === 500) {
        return NextResponse.json(
          { error: 'PodClaw bridge is not reachable' },
          { status: 503 }
        );
      }
      const error = await response.text();
      return NextResponse.json(
        { error: `Failed to fetch schedule: ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch schedule:', error);
    return NextResponse.json(
      { error: 'PodClaw bridge is not reachable' },
      { status: 503 }
    );
  }
}

/**
 * PUT /api/agent/schedule
 * Updates agent schedules and persists changes
 * Body: { schedule: AgentSchedule[] }
 */
export async function PUT(req: NextRequest) {
  const authError = await checkAdminAuth();
  if (authError) return authError;

  try {
    const body = await req.json();

    if (!body.schedule || !Array.isArray(body.schedule)) {
      return NextResponse.json(
        { error: 'Missing or invalid "schedule" field in request body' },
        { status: 400 }
      );
    }

    const response = await fetch(`${PODCLAW_BRIDGE_URL}/schedule`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PODCLAW_BRIDGE_AUTH_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Failed to update schedule: ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to update schedule:', error);
    return NextResponse.json(
      { error: 'Failed to update schedule' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent/schedule
 * Resets schedule to default configuration
 * Body: { action: "reset" }
 */
export async function POST(req: NextRequest) {
  const authError = await checkAdminAuth();
  if (authError) return authError;

  try {
    const body = await req.json();

    if (body.action !== 'reset') {
      return NextResponse.json(
        { error: 'Invalid action. Use {"action": "reset"}' },
        { status: 400 }
      );
    }

    const response = await fetch(`${PODCLAW_BRIDGE_URL}/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PODCLAW_BRIDGE_AUTH_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Failed to reset schedule: ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to reset schedule:', error);
    return NextResponse.json(
      { error: 'Failed to reset schedule' },
      { status: 500 }
    );
  }
}
