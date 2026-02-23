#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load env from frontend
config({ path: resolve('project/frontend/.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function createTestNotifications() {
  const testNotifications = [
    {
      id: `order-${Date.now()}-1`,
      recipient_type: 'admin',
      type: 'order',
      title: 'New Order Received',
      message: 'Order #TEST-001 placed by customer',
      read: false,
      created_at: new Date().toISOString(),
    },
    {
      id: `order-${Date.now()}-2`,
      recipient_type: 'admin',
      type: 'order',
      title: 'Order Shipped',
      message: 'Order #TEST-002 has been shipped',
      read: false,
      created_at: new Date(Date.now() - 60000).toISOString(),
    },
    {
      id: `agent-${Date.now()}-1`,
      recipient_type: 'admin',
      type: 'agent',
      title: 'Agent Cycle Complete',
      message: 'Cataloger agent finished processing',
      read: false,
      created_at: new Date(Date.now() - 120000).toISOString(),
    },
    {
      id: `alert-${Date.now()}-1`,
      recipient_type: 'admin',
      type: 'alert',
      title: 'Low Stock Alert',
      message: 'Product inventory is running low',
      read: false,
      created_at: new Date(Date.now() - 180000).toISOString(),
    },
    {
      id: `info-${Date.now()}-1`,
      recipient_type: 'admin',
      type: 'info',
      title: 'System Update',
      message: 'System maintenance scheduled for tonight',
      read: true, // One read notification
      created_at: new Date(Date.now() - 240000).toISOString(),
    },
  ];

  for (const notification of testNotifications) {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notification)
      .select()
      .single();

    if (error) {
      console.error('Failed to insert notification:', error.message);
    } else {
      console.log(`✓ Created ${notification.type} notification: ${notification.title}`);
    }
  }

  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_type', 'admin');

  console.log(`\n✓ Total admin notifications in database: ${count}`);
}

createTestNotifications().catch(console.error);
