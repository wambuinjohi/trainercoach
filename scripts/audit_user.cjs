const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

async function findUserByEmail(email) {
  // Try listing auth users
  try {
    const res = await admin.auth.admin.listUsers({ filter: `email.eq.${email}` })
    const u = res.data?.users?.[0]
    if (u) return u
  } catch (e) {}
  // fallback query profiles
  try {
    const { data } = await admin.from('user_profiles').select('*').ilike('full_name', `%${email.split('@')[0]}%`).limit(1)
    if (data && data.length > 0) return data[0]
  } catch (e) {}
  return null
}

async function audit(email) {
  const ident = email || process.argv[2]
  if (!ident) { console.error('Usage: node audit_user.cjs <email>'); process.exit(1) }
  console.log('Auditing user:', ident)
  const authUser = await findUserByEmail(ident)
  if (!authUser) { console.error('User not found'); return }
  console.log('Found auth/profile:', authUser.id || authUser.user_id)
  const uid = authUser.id || authUser.user_id

  // fetch profile
  const { data: profile } = await admin.from('user_profiles').select('*').eq('user_id', uid).maybeSingle()
  console.log('Profile:', profile)

  // fetch services
  try { const { data: services } = await admin.from('services').select('*').eq('trainer_id', uid); console.log('Services:', services || []) } catch (e) { console.log('Services error', e.message || e) }

  // bookings
  try { const { data: bookings } = await admin.from('bookings').select('*').or(`trainer_id.eq.${uid},client_id.eq.${uid}`).order('session_date', { ascending: true }); console.log('Bookings (trainer/client):', bookings || []) } catch (e) { console.log('Bookings error', e.message || e) }

  // messages
  try { const { data: messages } = await admin.from('messages').select('*').or(`trainer_id.eq.${uid},client_id.eq.${uid}`).order('created_at', { ascending: false }).limit(20); console.log('Recent messages:', (messages||[]).slice(0,10)) } catch (e) { console.log('Messages error', e.message || e) }

  // reviews
  try { const { data: reviews } = await admin.from('reviews').select('*').or(`trainer_id.eq.${uid},client_id.eq.${uid}`); console.log('Reviews:', reviews || []) } catch (e) { console.log('Reviews error', e.message || e) }

  // payments
  try { const { data: payments } = await admin.from('payments').select('*').or(`trainer_id.eq.${uid},user_id.eq.${uid}`).order('created_at', { ascending: false }).limit(20); console.log('Payments:', payments || []) } catch (e) { console.log('Payments error', e.message || e) }

  // payouts
  try { const { data: payouts } = await admin.from('payouts').select('*').eq('trainer_id', uid).order('requested_at', { ascending: false }).limit(10); console.log('Payouts:', payouts || []) } catch (e) { console.log('Payouts error', e.message || e) }

  // referrals
  try { const { data: referrals } = await admin.from('referrals').select('*').or(`referrer_id.eq.${uid},referee_id.eq.${uid}`); console.log('Referrals:', referrals || []) } catch (e) { console.log('Referrals error', e.message || e) }

}

audit(process.argv[2])
