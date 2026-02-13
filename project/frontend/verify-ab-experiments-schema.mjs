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

console.log('🔍 Verifying ab_experiments table schema...\n');

// Test 1: Create an experiment with variants (JSONB) and no explicit status (should default to 'draft')
console.log('🧪 Test 1: Creating experiment with variants (status defaults to draft)...');
const variants = {
  control: {
    name: 'Control',
    weight: 50
  },
  variant_a: {
    name: 'Variant A',
    weight: 50
  }
};

const { data: experiment1, error: error1 } = await supabase
  .from('ab_experiments')
  .insert({
    name: 'Test Experiment 1',
    description: 'Testing variants JSONB column',
    variants: variants
  })
  .select()
  .single();

if (error1) {
  console.error('❌ Error creating experiment:', error1.message);
  process.exit(1);
}

console.log('✅ Experiment created successfully:');
console.log('   ID:', experiment1.id);
console.log('   Name:', experiment1.name);
console.log('   Status:', experiment1.status, '(expected: draft)');
console.log('   Variants:', JSON.stringify(experiment1.variants));
console.log('   Variants type:', typeof experiment1.variants);

// Verify status defaults to 'draft'
if (experiment1.status !== 'draft') {
  console.error('❌ Status should default to "draft"');
  process.exit(1);
}

// Verify variants is an object (JSONB)
if (typeof experiment1.variants !== 'object') {
  console.error('❌ Variants should be an object (JSONB)');
  process.exit(1);
}

// Test 2: Create an experiment with explicit status = 'running'
console.log('\n🧪 Test 2: Creating experiment with explicit status = running...');
const { data: experiment2, error: error2 } = await supabase
  .from('ab_experiments')
  .insert({
    name: 'Test Experiment 2',
    description: 'Testing status column',
    variants: {
      control: { name: 'Control', weight: 100 }
    },
    status: 'running'
  })
  .select()
  .single();

if (error2) {
  console.error('❌ Error creating experiment with running status:', error2.message);
  process.exit(1);
}

console.log('✅ Experiment with running status created:');
console.log('   Status:', experiment2.status, '(expected: running)');

if (experiment2.status !== 'running') {
  console.error('❌ Status should be "running"');
  process.exit(1);
}

// Test 3: Try to create an experiment with invalid status (should fail due to CHECK constraint)
console.log('\n🧪 Test 3: Testing CHECK constraint on status (invalid status)...');
const { data: experiment3, error: error3 } = await supabase
  .from('ab_experiments')
  .insert({
    name: 'Test Experiment 3',
    description: 'Testing invalid status',
    variants: {
      control: { name: 'Control', weight: 100 }
    },
    status: 'invalid_status'
  })
  .select()
  .single();

if (error3) {
  if (error3.code === '23514' || error3.message.includes('check constraint') || error3.message.includes('violates')) {
    console.log('✅ CHECK constraint working: invalid status rejected');
  } else {
    console.error('❌ Unexpected error:', error3.message);
    process.exit(1);
  }
} else {
  console.error('❌ CHECK constraint not working: invalid status was accepted');
  process.exit(1);
}

// Test 4: Create an experiment with complex JSONB variants
console.log('\n🧪 Test 4: Creating experiment with complex JSONB variants...');
const complexVariants = {
  control: {
    name: 'Control',
    weight: 33.33,
    config: {
      buttonColor: '#0000FF',
      buttonText: 'Buy Now'
    }
  },
  variant_a: {
    name: 'Variant A',
    weight: 33.33,
    config: {
      buttonColor: '#FF0000',
      buttonText: 'Shop Now'
    }
  },
  variant_b: {
    name: 'Variant B',
    weight: 33.34,
    config: {
      buttonColor: '#00FF00',
      buttonText: 'Get Started'
    }
  }
};

const { data: experiment4, error: error4 } = await supabase
  .from('ab_experiments')
  .insert({
    name: 'Test Experiment 4',
    description: 'Testing complex JSONB variants',
    variants: complexVariants,
    status: 'completed'
  })
  .select()
  .single();

if (error4) {
  console.error('❌ Error creating experiment with complex variants:', error4.message);
  process.exit(1);
}

console.log('✅ Experiment with complex variants created:');
console.log('   Status:', experiment4.status, '(expected: completed)');
console.log('   Variants:', JSON.stringify(experiment4.variants, null, 2));

// Verify we can query the JSONB data
if (!experiment4.variants.control || !experiment4.variants.variant_a || !experiment4.variants.variant_b) {
  console.error('❌ JSONB variants structure not preserved');
  process.exit(1);
}

console.log('\n✅ All ab_experiments schema requirements verified!');
console.log('✅ variants column is JSONB');
console.log('✅ status column exists with default "draft" and CHECK constraint');
console.log('✅ Feature #37 verification: PASSED');
