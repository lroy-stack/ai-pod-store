import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-supabase-service-role-key'
);

// Check if admin user exists
const { data: existingAdmin } = await supabase
  .from('users')
  .select('id, email, role')
  .eq('email', 'admin@podclaw.com')
  .single();

if (existingAdmin) {
  console.log('Admin user already exists:', existingAdmin);
  process.exit(0);
}

// Create admin user
const passwordHash = await bcrypt.hash('admin123', 10);

const { data: newAdmin, error } = await supabase
  .from('users')
  .insert({
    email: 'admin@podclaw.com',
    password_hash: passwordHash,
    role: 'admin',
    name: 'Admin User',
    locale: 'en',
    currency: 'EUR',
    email_verified: true,
  })
  .select()
  .single();

if (error) {
  console.error('Error creating admin user:', error);
  process.exit(1);
}

console.log('Admin user created:', newAdmin);
console.log('Login credentials: admin@podclaw.com / admin123');
