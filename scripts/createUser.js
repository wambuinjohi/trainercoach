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
  const password = process.argv[3] || 'Test1234'
  const userType = process.argv[4] || 'client'
  if (!email) {
    console.error('Usage: node scripts/createUser.js <email> [password] [userType]')
    process.exit(1)
  }

  const { data: existing, error: listErr } = await admin.auth.admin.listUsers({ filter: `email.eq.${email}` })
  if (listErr) { console.error('List error:', listErr); process.exit(1) }
  if ((existing?.users || []).length > 0) {
    console.log('User already exists:', email)
    process.exit(0)
  }

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) { console.error('Create error:', error); process.exit(1) }
  const userId = data.user?.id
  if (!userId) { console.error('No user id returned'); process.exit(1) }

  const { error: upErr } = await admin.from('user_profiles').upsert({ user_id: userId, user_type: userType, full_name: '', phone_number: '' }, { onConflict: 'user_id' })
  if (upErr) { console.error('Profile upsert error:', upErr); process.exit(1) }

  console.log('Created user', email, 'with type', userType)
}

main()
