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

async function upsertProfile(userId, userType) {
  const { error } = await admin.from('user_profiles').upsert({ user_id: userId, user_type: userType, full_name: '', phone_number: '' }, { onConflict: 'user_id' })
  if (error) throw error
}

async function main() {
  const email = (process.argv[2] || '').trim()
  const password = process.argv[3] || 'Test1234'
  const userType = process.argv[4] || 'client'
  if (!email) {
    console.error('Usage: node scripts/ensure-user.js <email> [password] [userType]')
    process.exit(1)
  }
  const existing = await findUserByEmail(email)
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password })
    if (error) { console.error('Update password error:', error); process.exit(2) }
    await upsertProfile(existing.id, userType)
    console.log('Updated existing user', email)
    return
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) { console.error('Create error:', error); process.exit(3) }
  const userId = data.user?.id
  if (!userId) { console.error('No user id returned'); process.exit(4) }
  await upsertProfile(userId, userType)
  console.log('Created user', email)
}

main()
