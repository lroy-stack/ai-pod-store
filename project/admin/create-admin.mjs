/**
 * ⚠️  DEPRECATED - SECURITY RISK
 *
 * This script uses a hardcoded password and API keys.
 * For secure admin creation, use: node scripts/create-secure-admin.mjs
 *
 * This file is kept for backward compatibility in development/testing only.
 */

console.error('╔════════════════════════════════════════════════════════════╗')
console.error('║  ⚠️  WARNING: This script uses HARDCODED credentials!     ║')
console.error('║                                                            ║')
console.error('║  For production use: node scripts/create-secure-admin.mjs ║')
console.error('║                                                            ║')
console.error('║  This script is DEPRECATED and will be removed.           ║')
console.error('╚════════════════════════════════════════════════════════════╝')
console.error('')

process.exit(1)

// DEPRECATED CODE (commented out for security):
// import { createClient } from '@supabase/supabase-js';
// import bcrypt from 'bcryptjs';
//
// const supabase = createClient(
//   'https://your-project.supabase.co',
//   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // SECURITY: Hardcoded service key
// );
//
// // Check if admin user exists
// const { data: existingAdmin } = await supabase
//   .from('users')
//   .select('id, email, role')
//   .eq('email', 'admin@podclaw.com')
//   .single();
//
// if (existingAdmin) {
//   console.log('Admin user already exists:', existingAdmin);
//   process.exit(0);
// }
//
// // Create admin user
// const passwordHash = await bcrypt.hash('admin123', 10); // SECURITY: Hardcoded password
//
// const { data: newAdmin, error } = await supabase
//   .from('users')
//   .insert({
//     email: 'admin@podclaw.com',
//     password_hash: passwordHash,
//     role: 'admin',
//     name: 'Admin User',
//     locale: 'en',
//     currency: 'EUR',
//     email_verified: true,
//   })
//   .select()
//   .single();
//
// if (error) {
//   console.error('Error creating admin user:', error);
//   process.exit(1);
// }
//
// console.log('Admin user created:', newAdmin);
// console.log('Login credentials: admin@podclaw.com / admin123'); // SECURITY RISK
