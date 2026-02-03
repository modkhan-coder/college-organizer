import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts'

serve(async (req) => {
    try {
        // SUPABASE_DB_URL is available in the Edge Runtime environment
        const dbUrl = Deno.env.get('SUPABASE_DB_URL')
        if (!dbUrl) throw new Error('SUPABASE_DB_URL not set')

        const client = new Client(dbUrl)
        await client.connect()

        // Run the migration
        await client.queryArray(`
      ALTER TABLE pdf_files ADD COLUMN IF NOT EXISTS openai_file_id TEXT;
      ALTER TABLE syllabus_extractions ADD COLUMN IF NOT EXISTS run_id TEXT;
      ALTER TABLE syllabus_extractions ADD COLUMN IF NOT EXISTS thread_id TEXT;
      ALTER TABLE syllabus_extractions ADD COLUMN IF NOT EXISTS assistant_id TEXT;
    `)

        await client.end()

        return new Response("Migration successful - Columns added", { status: 200 })
    } catch (e) {
        return new Response(e.message, { status: 500 })
    }
})
