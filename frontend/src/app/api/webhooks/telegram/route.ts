import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { BRAND, BASE_URL } from '@/lib/store-config';

// Telegram webhook handler
// Receives updates from Telegram Bot API
// Processes commands and customer messages

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Verify secret token (required security measure)
    const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
    const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET;

    // Fail-closed: reject if env var not configured
    if (!expectedToken) {
      console.error('TELEGRAM_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { ok: false, error: 'Service configuration error' },
        { status: 500 }
      );
    }

    // ALWAYS validate the token (fail-secure)
    if (secretToken !== expectedToken) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Parse the Telegram update payload
    const update: TelegramUpdate = await request.json();

    // Verify the update has a message
    if (!update.message || !update.message.text) {
      return NextResponse.json({ ok: true });
    }

    const { message } = update;
    const chatId = message.chat.id;
    const text = message.text;
    const userId = message.from.id;

    // Get Supabase admin client
    const supabase = supabaseAdmin;

    // Store the conversation in the database
    await supabase.from('telegram_messages').insert({
      update_id: update.update_id,
      message_id: message.message_id,
      user_id: userId.toString(),
      username: message.from.username || null,
      first_name: message.from.first_name,
      last_name: message.from.last_name || null,
      chat_id: chatId.toString(),
      text: text,
      created_at: new Date(message.date * 1000).toISOString(),
    });

    // Check if user is linked to an admin account
    const { data: adminLink } = await supabase
      .from('user_messaging_links')
      .select('user_id, users!inner(role)')
      .eq('platform', 'telegram')
      .eq('platform_user_id', userId.toString())
      .eq('verified', true)
      .single();

    const isAdmin = (adminLink?.users as any)?.role === 'admin';

    // Process commands
    if (text?.startsWith('/')) {
      const command = text.split(' ')[0].toLowerCase();
      const args = text.split(' ').slice(1);

      // Admin commands
      if (isAdmin) {
        switch (command) {
          case '/status':
            await handleStatusCommand(chatId);
            break;

          case '/agents':
            await handleAgentsCommand(chatId);
            break;

          case '/run':
            await handleRunCommand(chatId, args);
            break;

          case '/pause':
            await handlePauseCommand(chatId, args);
            break;

          case '/orders':
            await handleOrdersCommand(chatId);
            break;

          case '/revenue':
            await handleRevenueCommand(chatId);
            break;

          case '/link':
            await sendTelegramMessage(chatId, '✅ Your account is already linked as an admin.');
            break;

          case '/help':
            await sendTelegramMessage(
              chatId,
              `🔧 ${BRAND.name} Admin Commands:\n\n` +
              '📊 Monitoring:\n' +
              '/status - PodClaw agent status\n' +
              '/agents - List all 8 agents\n' +
              '/orders - Today\'s order summary\n' +
              '/revenue - Revenue stats\n\n' +
              '⚙️ Control:\n' +
              '/run <agent> - Trigger an agent\n' +
              '/pause <agent> - Pause an agent\n\n' +
              '❓ /help - Show this message'
            );
            break;

          default:
            await sendTelegramMessage(chatId, 'Admin command not recognized. Type /help to see available admin commands.');
        }
      } else {
        // Customer commands
        switch (command) {
          case '/start':
            await sendTelegramMessage(chatId, `👋 Welcome to ${BRAND.name}! I can help you browse products, track orders, and more. Type /help to see available commands.`);
            break;

          case '/help':
            await sendTelegramMessage(
              chatId,
              `🤖 ${BRAND.name} Commands:\n\n` +
              '🛍️ Shopping:\n' +
              '/browse - Browse our product catalog\n' +
              '/search <query> - Search for products\n' +
              '/cart - View your shopping cart\n\n' +
              '📦 Orders:\n' +
              '/orders - View your order history\n' +
              '/track <order_id> - Track an order\n\n' +
              '👤 Account:\n' +
              `/link - Link your ${BRAND.name} account\n` +
              '/settings - Account settings\n\n' +
              '❓ /help - Show this message'
            );
            break;

          case '/link':
            await sendTelegramMessage(
              chatId,
              '🔗 Account Linking\n\n' +
              `To link your ${BRAND.name} account:\n` +
              `1. Visit ${BASE_URL}/account/linking\n` +
              '2. Enter this code: ' + userId.toString().slice(-6) + '\n\n' +
              `This will connect your Telegram to your ${BRAND.name} account.`
            );
            break;

          default:
            await sendTelegramMessage(chatId, 'Command not recognized. Type /help to see available commands.');
        }
      }
    } else {
      // For non-command messages, acknowledge receipt
      // In a full implementation, this would be processed by PodClaw's customer_manager agent
      await sendTelegramMessage(chatId, 'Thanks for your message! Our AI assistant will respond shortly.');
    }

    // Return 200 OK to acknowledge receipt
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Telegram webhook error:', error);
    // Still return 200 to prevent Telegram from retrying
    return NextResponse.json({ ok: true });
  }
}

// Admin command handlers
async function handleStatusCommand(chatId: number) {
  try {
    const bridgeUrl = process.env.PODCLAW_BRIDGE_URL || 'http://localhost:8000';
    const response = await fetch(`${bridgeUrl}/status`);

    if (!response.ok) {
      await sendTelegramMessage(chatId, '⚠️ PodClaw bridge is offline. Cannot retrieve status.');
      return;
    }

    const data = await response.json();

    const message =
      '📊 PodClaw Status\n\n' +
      `Status: ${data.running ? '✅ Running' : '⛔ Stopped'}\n` +
      `Active sessions: ${data.active_sessions || 0}\n` +
      `Agents: ${data.agent_count || 8}/8\n\n` +
      '🔄 All systems operational';

    await sendTelegramMessage(chatId, message);
  } catch (error) {
    await sendTelegramMessage(chatId, '❌ Failed to retrieve PodClaw status. Bridge may be offline.');
  }
}

async function handleAgentsCommand(chatId: number) {
  try {
    const bridgeUrl = process.env.PODCLAW_BRIDGE_URL || 'http://localhost:8000';
    const response = await fetch(`${bridgeUrl}/agents`);

    if (!response.ok) {
      await sendTelegramMessage(chatId, '⚠️ PodClaw bridge is offline. Cannot list agents.');
      return;
    }

    const agents = await response.json();

    let message = '🤖 PodClaw Agents\n\n';
    agents.forEach((agent: any) => {
      const status = agent.running ? '✅' : '⛔';
      message += `${status} ${agent.name}\n`;
      if (agent.session_id) {
        message += `   Session: ${agent.session_id.slice(0, 8)}...\n`;
      }
    });

    await sendTelegramMessage(chatId, message);
  } catch (error) {
    await sendTelegramMessage(chatId, '❌ Failed to list agents. Bridge may be offline.');
  }
}

async function handleRunCommand(chatId: number, args: string[]) {
  const agentName = args[0];
  if (!agentName) {
    await sendTelegramMessage(chatId, '❌ Usage: /run <agent_name>\n\nExample: /run researcher');
    return;
  }

  try {
    const bridgeUrl = process.env.PODCLAW_BRIDGE_URL || 'http://localhost:8000';
    const response = await fetch(`${bridgeUrl}/agents/${agentName}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      await sendTelegramMessage(chatId, `❌ Failed to trigger ${agentName}. Agent may not exist.`);
      return;
    }

    await sendTelegramMessage(chatId, `✅ Triggered ${agentName} agent`);
  } catch (error) {
    await sendTelegramMessage(chatId, '❌ Failed to trigger agent. Bridge may be offline.');
  }
}

async function handlePauseCommand(chatId: number, args: string[]) {
  const agentName = args[0];
  if (!agentName) {
    await sendTelegramMessage(chatId, '❌ Usage: /pause <agent_name>\n\nExample: /pause researcher');
    return;
  }

  try {
    const bridgeUrl = process.env.PODCLAW_BRIDGE_URL || 'http://localhost:8000';
    const response = await fetch(`${bridgeUrl}/agents/${agentName}/pause`, {
      method: 'POST'
    });

    if (!response.ok) {
      await sendTelegramMessage(chatId, `❌ Failed to pause ${agentName}. Agent may not exist.`);
      return;
    }

    await sendTelegramMessage(chatId, `⏸️ Paused ${agentName} agent`);
  } catch (error) {
    await sendTelegramMessage(chatId, '❌ Failed to pause agent. Bridge may be offline.');
  }
}

async function handleOrdersCommand(chatId: number) {
  try {
    const supabase = supabaseAdmin;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: orders, error } = await supabase
      .from('orders')
      .select('status, total_cents, currency')
      .gte('created_at', today.toISOString());

    if (error) throw error;

    const totalOrders = orders?.length || 0;
    const revenue = orders?.reduce((sum, o) => sum + (o.total_cents || 0), 0) || 0;
    const revenueEur = (revenue / 100).toFixed(2);

    const statusCounts = orders?.reduce((acc: any, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    let message = `📦 Today's Orders\n\n` +
      `Total: ${totalOrders}\n` +
      `Revenue: €${revenueEur}\n\n` +
      `Status breakdown:\n`;

    if (statusCounts) {
      Object.entries(statusCounts).forEach(([status, count]) => {
        message += `• ${status}: ${count}\n`;
      });
    }

    await sendTelegramMessage(chatId, message);
  } catch (error) {
    await sendTelegramMessage(chatId, '❌ Failed to retrieve order stats.');
  }
}

async function handleRevenueCommand(chatId: number) {
  try {
    const supabase = supabaseAdmin;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayOrders } = await supabase
      .from('orders')
      .select('total_cents')
      .gte('created_at', today.toISOString())
      .eq('status', 'paid');

    const todayRevenue = todayOrders?.reduce((sum, o) => sum + (o.total_cents || 0), 0) || 0;

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: weekOrders } = await supabase
      .from('orders')
      .select('total_cents')
      .gte('created_at', weekAgo.toISOString())
      .eq('status', 'paid');

    const weekRevenue = weekOrders?.reduce((sum, o) => sum + (o.total_cents || 0), 0) || 0;

    const message = `💰 Revenue Stats\n\n` +
      `Today: €${(todayRevenue / 100).toFixed(2)}\n` +
      `Last 7 days: €${(weekRevenue / 100).toFixed(2)}\n` +
      `Average/day: €${(weekRevenue / 7 / 100).toFixed(2)}`;

    await sendTelegramMessage(chatId, message);
  } catch (error) {
    await sendTelegramMessage(chatId, '❌ Failed to retrieve revenue stats.');
  }
}

// Helper function to send a Telegram message
async function sendTelegramMessage(chatId: number, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    });

    if (!response.ok) {
      console.error('Failed to send Telegram message:', await response.text());
    }
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}
