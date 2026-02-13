#!/usr/bin/env node
/**
 * Create a test user for profile CRUD testing
 * Bypasses email rate limits by using admin API
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const testEmail = 'profiletest@example.com';
const testPassword = 'testpass123456';
const testName = 'Profile Test User';

async function createTestUser() {
  try {
    console.log('Creating test user...');

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: testName,
      },
    });

    if (authError) {
      // Check if user already exists
      if (authError.message.includes('already registered')) {
        console.log('User already exists in Auth, fetching...');
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users.users.find(u => u.email === testEmail);

        if (existingUser) {
          console.log('Found existing user:', existingUser.id);

          // Check if user exists in users table
          const { data: dbUser } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', testEmail)
            .single();

          if (dbUser) {
            console.log('User exists in database');
            console.log('Email:', testEmail);
            console.log('Password:', testPassword);
            return;
          }

          // Create in users table
          const { error: insertError } = await supabaseAdmin
            .from('users')
            .insert({
              email: testEmail,
              name: testName,
              locale: 'en',
              currency: 'USD',
              email_verified: true,
              notification_preferences: {
                email: true,
                push: false,
                sms: false,
              },
            });

          if (insertError) {
            console.error('Error creating user in database:', insertError);
            return;
          }

          console.log('✓ User created in database');
          console.log('Email:', testEmail);
          console.log('Password:', testPassword);
          return;
        }
      }

      console.error('Error creating auth user:', authError);
      return;
    }

    console.log('✓ User created in Auth:', authData.user.id);

    // Create user in users table
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        email: testEmail,
        name: testName,
        locale: 'en',
        currency: 'USD',
        email_verified: true,
        notification_preferences: {
          email: true,
          push: false,
          sms: false,
        },
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error creating user in database:', dbError);
      return;
    }

    console.log('✓ User created in database:', dbUser.id);
    console.log('\n=== Test User Credentials ===');
    console.log('Email:', testEmail);
    console.log('Password:', testPassword);
    console.log('==============================\n');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createTestUser();
