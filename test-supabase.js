import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('URL:', supabaseUrl)
console.log('KEY:', supabaseKey)

const supabase = createClient(supabaseUrl, supabaseKey)

supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'test'
}).then(({ data, error }) => {
  if (error) {
    console.error('Login Failed:', error.message)
  } else {
    console.log('Login Success:', data)
  }
}).catch(e => console.error('Exception:', e))
