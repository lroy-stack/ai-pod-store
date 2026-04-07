import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Test endpoint to verify Telegram /status admin command
 * Creates a test admin user, links them to Telegram, and simulates the /status command
 */

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }


  try {
    const supabase = supabaseAdmin;

    // Step 1: Create or get a test admin user
    const testEmail = process.env.ADMIN_EMAIL || 'test@localhost';
    let { data: user } = await supabase
      .from('users')
      .select('id, role')
      .eq('email', testEmail)
      .single();

    if (!user) {
      // Create test admin user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: testEmail,
          name: 'Telegram Test Admin',
          role: 'admin'
        })
        .select()
        .single();

      if (createError) throw createError;
      user = newUser;
    } else {
      // Ensure user is admin
      if (user.role !== 'admin') {
        await supabase
          .from('users')
          .update({ role: 'admin' })
          .eq('id', user.id);
      }
    }

    // Step 2: Link Telegram user to admin account
    const telegramUserId = '111222333'; // Test Telegram user ID

    const { data: link, error: linkError } = await supabase
      .from('user_messaging_links')
      .upsert({
        user_id: user!.id,
        platform: 'telegram',
        platform_user_id: telegramUserId,
        platform_username: 'testadmin',
        verified: true
      }, {
        onConflict: 'platform,platform_user_id'
      })
      .select()
      .single();

    if (linkError) throw linkError;

    // Step 3: Test the /status command logic
    // Check if PodClaw bridge is available
    const bridgeUrl = process.env.PODCLAW_BRIDGE_URL || 'http://localhost:8000';
    let podclawStatus = null;
    let bridgeOnline = false;

    try {
      const response = await fetch(`${bridgeUrl}/status`, {
        signal: AbortSignal.timeout(2000)
      });
      bridgeOnline = response.ok;
      if (response.ok) {
        podclawStatus = await response.json();
      }
    } catch (error) {
      // Bridge is offline - this is expected if PodClaw is not running
      bridgeOnline = false;
    }

    // Step 4: Simulate what the /status command would return
    let expectedBotResponse: string;
    if (bridgeOnline && podclawStatus) {
      expectedBotResponse =
        '📊 PodClaw Status\n\n' +
        `Status: ${podclawStatus.running ? '✅ Running' : '⛔ Stopped'}\n` +
        `Active sessions: ${podclawStatus.active_sessions || 0}\n` +
        `Agents: ${podclawStatus.agent_count || 8}/8\n\n` +
        '🔄 All systems operational';
    } else {
      expectedBotResponse = '⚠️ PodClaw bridge is offline. Cannot retrieve status.';
    }

    return NextResponse.json({
      success: true,
      adminUserCreated: !!user,
      adminUserId: user!.id,
      telegramLinked: true,
      telegramUserId,
      linkId: link.id,
      podclawBridgeOnline: bridgeOnline,
      podclawStatus,
      expectedBotResponse,
      testInstructions: [
        '1. Admin user created/verified',
        '2. Telegram account linked',
        '3. /status command would check PodClaw bridge',
        `4. Bot would respond: "${expectedBotResponse.substring(0, 50)}..."`
      ]
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
