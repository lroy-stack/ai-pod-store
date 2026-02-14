import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-supabase-service-role-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Get the test user
const { data: users, error: userError } = await supabase
  .from('users')
  .select('id')
  .eq('email', 'testuser@example.com')
  .single();

if (userError || !users) {
  console.error('Error finding test user:', userError);
  process.exit(1);
}

const userId = users.id;
console.log(`Creating 30 notifications for user ${userId}...`);

// Create 30 notifications
const notifications = [];
for (let i = 1; i <= 30; i++) {
  notifications.push({
    user_id: userId,
    type: 'info',
    title: `Test Notification ${i}`,
    body: `This is test notification number ${i} for pagination testing.`,
    is_read: false,
  });
}

const { data, error } = await supabase
  .from('notifications')
  .insert(notifications)
  .select();

if (error) {
  console.error('Error creating notifications:', error);
  process.exit(1);
}

console.log(`✅ Successfully created ${data.length} notifications`);
