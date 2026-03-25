import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export function createClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('METARDU: Missing Supabase environment variables')
    throw new Error('Supabase client not configured')
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

export async function testConnection() {
  const supabase = createClient()
  const { data, error } = await supabase.from('survey_points').select('count').limit(1)
  // connection verified
  return { data, error }
}
