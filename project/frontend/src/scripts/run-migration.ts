import { supabaseAdmin } from '../lib/supabase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: npx tsx src/scripts/run-migration.ts <migration-file.sql>');
  process.exit(1);
}

const sql = readFileSync(resolve(migrationFile), 'utf8');

console.log('Running migration:', migrationFile);
console.log('SQL:', sql);
console.log('');

async function runMigration() {
  try {
    // Split into statements
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 80) + '...');

      // Execute via raw SQL query
      const { error } = await supabaseAdmin.rpc('exec_sql', {
        query: statement,
      });

      if (error) {
        // Try direct query via the PostgreSQL REST API
        console.log('RPC failed, trying direct query...');
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/query`,
          {
            method: 'POST',
            headers: {
              apikey: process.env.SUPABASE_SERVICE_KEY!,
              Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: statement }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to execute statement: ${await response.text()}`);
        }

        console.log('✓ Statement executed successfully');
      } else {
        console.log('✓ Statement executed successfully');
      }
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
