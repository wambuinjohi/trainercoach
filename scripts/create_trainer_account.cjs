const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

async function main() {
  const email = process.argv[2] || 'trainer_demo@skatryk.local'
  const password = process.argv[3] || 'Test1234'
  try {
    // create auth user
    const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    const uid = data.user?.id
    if (!uid) {
      console.error('Failed to create auth user')
      return
    }
    console.log('Created trainer auth user', email, uid)

    // upsert profile
    const profile = {
      user_id: uid,
      user_type: 'trainer',
      full_name: 'Demo Trainer',
      bio: 'Demo trainer account for dashboard audit',
      hourly_rate: 50,
      disciplines: ['Ballet','Dance'],
      rating: 4.9,
      total_reviews: 3,
      is_approved: true
    }
    const { error: upErr } = await admin.from('user_profiles').upsert(profile, { onConflict: 'user_id' })
    if (upErr) console.warn('profile upsert error', upErr)

    // services
    try { await admin.from('services').insert([{ trainer_id: uid, title: 'Demo Private', price: 50 }]) } catch (e) { console.warn('services insert', e.message || e) }

    // bookings (one upcoming, one completed)
    const today = new Date()
    const dateStr = (d) => d.toISOString().slice(0,10)
    const upcoming = new Date(today.getTime() + 86400000)
    const past = new Date(today.getTime() - 86400000)

    // find or create a client user
    let clientId = null
    try {
      const { data: clients } = await admin.from('user_profiles').select('user_id').eq('user_type','client').limit(1)
      if (clients && clients.length > 0) clientId = clients[0].user_id
    } catch {}
    if (!clientId) {
      try {
        const { data: cdata } = await admin.auth.admin.createUser({ email: 'client_demo@skatryk.local', password: 'Test1234', email_confirm: true })
        clientId = cdata.user?.id
        await admin.from('user_profiles').upsert({ user_id: clientId, user_type: 'client', full_name: 'Demo Client' }, { onConflict: 'user_id' })
      } catch (e) { console.warn('create client failed', e.message || e) }
    }

    try {
      await admin.from('bookings').insert([
        { client_id: clientId, trainer_id: uid, session_date: dateStr(upcoming), session_time: '11:00', duration_hours: 1, total_sessions: 1, status: 'confirmed', total_amount: 50 },
        { client_id: clientId, trainer_id: uid, session_date: dateStr(past), session_time: '09:00', duration_hours: 1, total_sessions: 1, status: 'completed', total_amount: 50 }
      ])
    } catch (e) { console.warn('bookings insert', e.message || e) }

    try { await admin.from('messages').insert({ trainer_id: uid, client_id: clientId, content: 'Welcome demo client!', created_at: new Date().toISOString() }) } catch (e) { console.warn('messages insert', e.message || e) }

    try { await admin.from('payments').insert({ user_id: clientId, trainer_id: uid, amount: 50, status: 'completed', method: 'card', created_at: new Date().toISOString() }) } catch (e) { console.warn('payments insert', e.message || e) }

    console.log('Demo trainer seeded. Sign in with:', email, '/', password)
  } catch (err) {
    console.error('Failed to create demo trainer', err)
  }
}

main()
