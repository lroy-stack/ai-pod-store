import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createHmac } from 'crypto';
import { BRAND } from '@/lib/store-config';

// WhatsApp webhook handler
// Receives updates from WhatsApp Business API
// Processes customer messages and commands

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: {
    body: string;
  };
  type: string;
}

interface WhatsAppUpdate {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: WhatsAppMessage[];
      };
      field: string;
    }>;
  }>;
}

// GET handler for WhatsApp webhook verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error('WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Verify the challenge
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WhatsApp webhook verified');
    return new NextResponse(challenge, { status: 200 });
  }

  console.error('WhatsApp webhook verification failed');
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// POST handler for WhatsApp webhook messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const update: WhatsAppUpdate = JSON.parse(body);

    // Fail closed: reject if WHATSAPP_APP_SECRET is not configured
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
      console.error('WHATSAPP_APP_SECRET not configured — failing closed');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Verify signature (always required in production)
    const signature = request.headers.get('x-hub-signature-256');
    if (!signature) {
      console.error('WhatsApp webhook missing x-hub-signature-256 header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 403 });
    }

    const expectedSignature = 'sha256=' + createHmac('sha256', appSecret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('WhatsApp webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Verify this is a WhatsApp update
    if (update.object !== 'whatsapp_business_account') {
      return NextResponse.json({ ok: true });
    }

    // Process each entry
    for (const entry of update.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') {
          continue;
        }

        const { value } = change;
        const messages = value.messages || [];
        const contacts = value.contacts || [];

        // Process each message
        for (const message of messages) {
          const contact = contacts.find(c => c.wa_id === message.from);
          const contactName = contact?.profile?.name || 'Unknown';

          // Store the message in the database
          const supabase = supabaseAdmin;
          await supabase.from('whatsapp_messages').insert({
            message_id: message.id,
            phone_number: message.from,
            contact_name: contactName,
            phone_number_id: value.metadata.phone_number_id,
            message_type: message.type,
            text_body: message.text?.body || null,
            timestamp: new Date(message.timestamp).toISOString(),
          });

          // Process text messages
          if (message.type === 'text' && message.text?.body) {
            const text = message.text.body.trim();

            // Process commands
            if (text.startsWith('/')) {
              await handleWhatsAppCommand(message.from, text, value.metadata.phone_number_id);
            } else {
              // For non-command messages, acknowledge receipt
              // In a full implementation, this would be processed by PodClaw's customer_manager agent
              await sendWhatsAppMessage(
                message.from,
                'Thanks for your message! Our AI assistant will respond shortly.',
                value.metadata.phone_number_id
              );
            }
          }
        }
      }
    }

    // Return 200 OK to acknowledge receipt
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('WhatsApp webhook error:', error);
    // Still return 200 to prevent WhatsApp from retrying
    return NextResponse.json({ ok: true });
  }
}

// Handle WhatsApp commands
async function handleWhatsAppCommand(phoneNumber: string, text: string, phoneNumberId: string) {
  const command = text.split(' ')[0].toLowerCase();

  switch (command) {
    case '/start':
      await sendWhatsAppMessage(
        phoneNumber,
        `👋 Welcome to ${BRAND.name}! I can help you browse products, track orders, and more. Type /help to see available commands.`,
        phoneNumberId
      );
      break;

    case '/help':
      await sendWhatsAppMessage(
        phoneNumber,
        `🤖 ${BRAND.name} Commands:\n\n` +
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
        '❓ /help - Show this message',
        phoneNumberId
      );
      break;

    case '/status':
      // Admin command - check if this is an admin user
      // For now, just return a simple response
      await sendWhatsAppMessage(
        phoneNumber,
        `✅ ${BRAND.name} is online and ready to assist you!`,
        phoneNumberId
      );
      break;

    default:
      await sendWhatsAppMessage(
        phoneNumber,
        'Command not recognized. Type /help to see available commands.',
        phoneNumberId
      );
  }
}

// Helper function to send a WhatsApp message
async function sendWhatsAppMessage(to: string, text: string, phoneNumberId: string) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!accessToken) {
    console.error('WHATSAPP_ACCESS_TOKEN not configured');
    return;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: {
            body: text,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Failed to send WhatsApp message:', await response.text());
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
  }
}
