import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Test endpoint to verify Telegram command handling
 * Simulates what the webhook handler does for /start command
 * WITHOUT requiring actual Telegram Bot API credentials
 */

export async function POST(request: Request) {
  // Block in production and any non-development environment
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }


  try {
    const body = await request.json();
    const command = body.command || '/start';
    const userId = body.userId || '123456789';
    const chatId = body.chatId || '123456789';

    // Simulate storing a message (like the webhook does)
    const { data: message, error } = await supabaseAdmin
      .from('telegram_messages')
      .insert({
        update_id: Date.now(),
        message_id: Date.now(),
        user_id: userId,
        username: 'test_user',
        first_name: 'Test',
        last_name: 'User',
        chat_id: chatId,
        text: command,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Determine the response based on command
    let botResponse: string;

    if (command === '/start') {
      botResponse = '👋 Welcome to ' + (process.env.NEXT_PUBLIC_SITE_NAME || 'My POD Store') + '! I can help you browse products, track orders, and more. Type /help to see available commands.';
    } else if (command === '/help') {
      botResponse = '🤖 ' + (process.env.NEXT_PUBLIC_SITE_NAME || 'Store') + ' Commands:\n\n' +
        '🛍️ Shopping:\n' +
        '/browse - Browse our product catalog\n' +
        '/search <query> - Search for products\n' +
        '/cart - View your shopping cart\n\n' +
        '📦 Orders:\n' +
        '/orders - View your order history\n' +
        '/track <order_id> - Track an order\n\n' +
        '👤 Account:\n' +
        '/link - Link your account\n' +
        '/settings - Account settings\n\n' +
        '❓ /help - Show this message';
    } else {
      botResponse = 'Command not recognized. Type /help to see available commands.';
    }

    return NextResponse.json({
      success: true,
      command,
      messageStored: true,
      messageId: message.id,
      botResponse,
      note: 'In production, this response would be sent via Telegram Bot API sendMessage'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * GET handler for quick testing
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }


  // Test /start command by default
  const testBody = {
    command: '/start',
    userId: '999888777',
    chatId: '999888777'
  };

  const response = await POST(new Request('http://localhost:3000/api/telegram/test-command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testBody)
  }));

  return response;
}
