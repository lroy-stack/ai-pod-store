const { createClient } = require('@supabase/supabase-js');

// Use service role key for admin access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

(async () => {
  try {
    // Insert a new pending design
    const { data, error } = await supabase
      .from('designs')
      .insert({
        prompt: 'Test pending design for browser test',
        style: 'realistic',
        image_url: 'https://via.placeholder.com/512/4A90E2/FFFFFF?text=Test+Pending',
        thumbnail_url: 'https://via.placeholder.com/256/4A90E2/FFFFFF?text=Test',
        width: 512,
        height: 512,
        moderation_status: 'pending',
        user_id: '00000000-0000-0000-0000-000000000000'
      })
      .select();
    
    if (error) {
      console.log('Insert error:', JSON.stringify(error, null, 2));
      process.exit(1);
    } else {
      console.log('Successfully inserted design:', JSON.stringify(data, null, 2));
      process.exit(0);
    }
  } catch (err) {
    console.log('Exception:', err.message);
    process.exit(1);
  }
})();
