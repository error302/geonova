import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function testConnection() {
  const supabase = createClient()
  const { data, error } = await supabase.from('survey_points').select('count').limit(1)
  console.log('Supabase connection test:', { data, error })
  return { data, error }
}
