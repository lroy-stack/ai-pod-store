import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-supabase-service-role-key';
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Checking recent audit_log entries...\n');

// Get recent audit log entries
const { data: logs, error } = await supabase
  .from('audit_log')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(10);

if (error) {
  console.error('Error fetching audit logs:', error);
  process.exit(1);
}

console.log(`Found ${logs.length} recent audit log entries:\n`);

logs.forEach((log, i) => {
  console.log(`${i + 1}. Action: ${log.action}`);
  console.log(`   Actor: ${log.actor_type} (${log.actor_id})`);
  console.log(`   Resource: ${log.resource_type} (${log.resource_id?.slice(0, 8)}...)`);
  console.log(`   Time: ${log.created_at}`);
  console.log('');
});

// Check for specific order events
const orderEvents = logs.filter(l => l.resource_type === 'order');
console.log(`\n✅ Found ${orderEvents.length} order-related audit log entries`);

const shippedEvents = logs.filter(l => l.action === 'order_shipped');
console.log(`✅ Found ${shippedEvents.length} order_shipped events`);
