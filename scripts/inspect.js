import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

async function main() {
  const email = (process.argv[2] || '').trim()
  if (!email) {
    console.error('Usage: node scripts/inspect.js <email>')
    process.exit(1)
  }
  const { data, error } = await admin.auth.admin.listUsers({ filter: `email.eq.${email}` })
  if (error) {
    console.error('Error listing users:', error)
    process.exit(1)
  }
  const users = data?.users || []
  console.log(JSON.stringify(users.map(u => ({ id: u.id, email: u.email, email_confirmed_at: u.email_confirmed_at, last_sign_in_at: u.last_sign_in_at, identities: u.identities })), null, 2))
}

main()
