import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim()
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim()

const supabase = createClient(url, key)

async function check() {
    console.log('Checking pdf_files table...');
    const { data, error } = await supabase.from('pdf_files').select('*').order('uploaded_at', { ascending: false }).limit(5)

    if (error) {
        console.error('Error fetching pdf_files:', error)
    } else {
        console.log(`Found ${data.length} recent PDF files:`)
        data.forEach(p =\u003e {
            console.log(`- ID: ${p.id}, File: ${p.file_name}, Course: ${p.course_id}, User: ${p.user_id}, Date: ${p.uploaded_at}`)
        })
    }
}

check()
