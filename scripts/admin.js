import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

async function resetPasswords(emails, password) {
  for (const email of emails) {
    try {
      const { data, error } = await admin.auth.admin.updateUserById((await admin.auth.admin.listUsers({ filter: `email.eq.${email}` })).data?.users?.[0]?.id, { password })
      if (error) console.warn('Reset password error for', email, error)
      else console.log('Password reset for', email)
    } catch (err) {
      console.warn('Reset password exception for', email, err)
    }
  }
}

async function setUserTypes(entries) {
  for (const e of entries) {
    try {
      const email = e.email
      const user_type = e.user_type
      const list = await admin.auth.admin.listUsers({ filter: `email.eq.${email}` })
      const user = list.data?.users?.[0]
      if (!user) { console.warn('User not found for', email); continue }
      const userId = user.id
      // upsert profile
      const { error } = await admin.from('user_profiles').upsert({ user_id: userId, user_type, full_name: user.user_metadata?.full_name || '', phone_number: '' }, { onConflict: 'user_id' })
      if (error) console.warn('Set user type upsert error', error)
      else console.log('Set user type for', email, 'to', user_type)
    } catch (err) {
      console.warn('Set user type exception', err)
    }
  }
}

async function main() {
  const cmd = process.argv[2]
  if (cmd === 'resetPasswords') {
    const password = process.argv[3] || 'Test1234'
    const emails = process.argv.slice(4)
    await resetPasswords(emails, password)
  } else if (cmd === 'setUserTypes') {
    // expect pairs email:type
    const pairs = process.argv.slice(3)
    const entries = []
    for (const p of pairs) {
      const [email, type] = p.split(':')
      entries.push({ email, user_type: type })
    }
    await setUserTypes(entries)
  } else {
    console.log('Usage: node scripts/admin.js resetPasswords <password> <email1> <email2>...')
    console.log('       node scripts/admin.js setUserTypes email1:trainer email2:client')
  }
  process.exit(0)
}

main()
