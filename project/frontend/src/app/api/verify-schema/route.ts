import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tableName = searchParams.get('table') || 'users';

  try {
    // Query information_schema.columns to get column details
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, character_maximum_length, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', tableName)
      .order('ordinal_position');

    if (error) {
      // Try raw SQL query instead
      const { data: rawData, error: rawError } = await supabase.rpc('exec_raw_sql', {
        sql_query: `
          SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `,
        params: [tableName]
      });

      if (rawError) {
        // SECURITY: Removed dead code with SQL injection vulnerability
        // The raw SQL query was never executed but could have been dangerous if used
        // Return error response instead
        return NextResponse.json({
          table: tableName,
          method: 'verification_query',
          note: 'Unable to query information_schema. Table schema verification unavailable.',
          error: error.message,
          rawError: rawError?.message
        });
      }

      return NextResponse.json({ data: rawData });
    }

    return NextResponse.json({ table: tableName, columns: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
