import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';

export async function POST() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    session.destroy();
    return Response.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return Response.json(
      { error: 'An error occurred during logout' },
      { status: 500 }
    );
  }
}
