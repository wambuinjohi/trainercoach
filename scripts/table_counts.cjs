const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

async function main() {
  const tables = ['user_profiles','services','bookings','messages','payments','payouts','referrals','reviews']
  for (const t of tables) {
    try {
      const { count } = await admin.from(t).select('*', { count: 'exact', head: true })
      console.log(`${t}:`, count || 0)
    } catch (e) {
      console.log(`${t}: error (${e.message || e})`)
    }
  }
}

main()
