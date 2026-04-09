import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

console.log('Using URL:', url ? '(present)' : '(missing)')
console.log('Using Key:', key ? '(present)' : '(missing)')

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

;(async () => {
  try {
    const { data, error, status } = await supabase.from('user_profiles').select('id').limit(1)
    console.log('Status:', status)
    if (error) {
      console.error('Supabase error:', error)
      process.exit(1)
    }
    console.log('Data:', data)
    process.exit(0)
  } catch (err) {
    console.error('Exception:', err)
    process.exit(1)
  }
})()
