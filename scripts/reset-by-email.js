import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

async function findUserByEmail(target) {
  const wanted = String(target).toLowerCase()
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data?.users || []
    for (const u of users) {
      const email = String(u.email || '').toLowerCase()
      if (email === wanted) return u
    }
    if (users.length < perPage) break
    page += 1
  }
  return null
}

async function main() {
  const email = (process.argv[2] || '').trim()
  const password = process.argv[3] || 'Test1234'
  const userType = process.argv[4] || 'client'
  if (!email) {
    console.error('Usage: node scripts/reset-by-email.js <email> [password] [userType]')
    process.exit(1)
  }
  const user = await findUserByEmail(email)
  if (!user) {
    console.error('User not found:', email)
    process.exit(2)
  }
  const { error: upErr } = await admin.auth.admin.updateUserById(user.id, { password })
  if (upErr) { console.error('Update password error:', upErr); process.exit(3) }
  const { error: profErr } = await admin.from('user_profiles').upsert({ user_id: user.id, user_type: userType, full_name: '', phone_number: '' }, { onConflict: 'user_id' })
  if (profErr) { console.error('Profile upsert error:', profErr); process.exit(4) }
  console.log('Password reset and profile set for', email)
}

main()
