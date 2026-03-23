import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hqdovpgztgqhumhnvfoh.supabase.co'
const supabaseKey = 'sb_publishable_Zgm8YGuSBmo-ZpfxQqAvBg_gGj-u6lI'

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
