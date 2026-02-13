#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env.local file
const envPath = join(__dirname, '.env.local');
const envContent = readFileSync(envPath, 'utf-8');

const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const supabaseUrl = envVars.SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 Verifying translations table schema...\n');

// Test 1: Insert a valid translation
console.log('🧪 Test 1: Inserting a valid translation...');
const timestamp = Date.now();
const { data: translation1, error: error1 } = await supabase
  .from('translations')
  .insert({
    namespace: 'test',
    key: `test_key_${timestamp}`,
    locale: 'en',
    value: 'Test value in English'
  })
  .select()
  .single();

if (error1) {
  console.error('❌ Error inserting translation:', error1.message);
  process.exit(1);
}

console.log('✅ Translation inserted successfully:');
console.log('   Namespace:', translation1.namespace);
console.log('   Key:', translation1.key);
console.log('   Locale:', translation1.locale);
console.log('   Value:', translation1.value);

// Test 2: Insert the same translation with a different locale (should succeed)
console.log('\n🧪 Test 2: Inserting same key/namespace with different locale (should succeed)...');
const { data: translation2, error: error2 } = await supabase
  .from('translations')
  .insert({
    namespace: 'test',
    key: `test_key_${timestamp}`,
    locale: 'es',
    value: 'Valor de prueba en español'
  })
  .select()
  .single();

if (error2) {
  console.error('❌ Error inserting translation with different locale:', error2.message);
  process.exit(1);
}

console.log('✅ Translation with different locale inserted successfully:');
console.log('   Locale:', translation2.locale);
console.log('   Value:', translation2.value);

// Test 3: Try to insert a duplicate (same namespace, key, locale) - should fail
console.log('\n🧪 Test 3: Testing UNIQUE constraint (duplicate translation)...');
const { data: duplicate, error: duplicateError } = await supabase
  .from('translations')
  .insert({
    namespace: 'test',
    key: `test_key_${timestamp}`,
    locale: 'en',
    value: 'This should fail due to UNIQUE constraint'
  })
  .select()
  .single();

if (duplicateError) {
  if (duplicateError.code === '23505' || duplicateError.message.includes('duplicate') || duplicateError.message.includes('unique')) {
    console.log('✅ UNIQUE constraint working: duplicate translation rejected');
  } else {
    console.error('❌ Unexpected error:', duplicateError.message);
    process.exit(1);
  }
} else {
  console.error('❌ UNIQUE constraint not working: duplicate translation was inserted');
  process.exit(1);
}

// Test 4: Verify we can insert the same key in a different namespace
console.log('\n🧪 Test 4: Inserting same key in different namespace (should succeed)...');
const { data: translation3, error: error3 } = await supabase
  .from('translations')
  .insert({
    namespace: 'test2',
    key: `test_key_${timestamp}`,
    locale: 'en',
    value: 'Same key but different namespace'
  })
  .select()
  .single();

if (error3) {
  console.error('❌ Error inserting translation with different namespace:', error3.message);
  process.exit(1);
}

console.log('✅ Translation with different namespace inserted successfully:');
console.log('   Namespace:', translation3.namespace);
console.log('   Key:', translation3.key);
console.log('   Value:', translation3.value);

console.log('\n✅ All translations schema requirements verified!');
console.log('✅ UNIQUE constraint on (namespace, key, locale) works correctly');
console.log('✅ Feature #36 verification: PASSED');
