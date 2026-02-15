import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

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

    // Process commands
    if (text.startsWith('/')) {
      const command = text.split(' ')[0].toLowerCase();

      switch (command) {
        case '/start':
          await sendTelegramMessage(chatId, '👋 Welcome to POD AI! I can help you browse products, track orders, and more. Type /help to see available commands.');
          break;

        case '/help':
          await sendTelegramMessage(
            chatId,
            '🤖 POD AI Commands:\n\n' +
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
            '❓ /help - Show this message'
          );
          break;

        default:
          // For unknown commands, just acknowledge
          await sendTelegramMessage(chatId, 'Command not recognized. Type /help to see available commands.');
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
