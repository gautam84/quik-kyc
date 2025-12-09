import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        'Missing Supabase environment variables!\n' +
        'Please add the following to your .env.local file:\n' +
        '  NEXT_PUBLIC_SUPABASE_URL=your_project_url\n' +
        '  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_anon_key\n' +
        'Get these from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api'
    )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
