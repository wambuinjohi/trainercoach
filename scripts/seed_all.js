import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

async function findUser(email) {
  const wanted = String(email).toLowerCase()
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data?.users || []
    for (const u of users) {
      if (String(u.email || '').toLowerCase() === wanted) return u
    }
    if (users.length < perPage) break
    page += 1
  }
  return null
}

async function ensureProfile(userId, user_type, full_name = '', phone_number = '') {
  const { error } = await admin.from('user_profiles').upsert({ user_id: userId, user_type, full_name, phone_number }, { onConflict: 'user_id' })
  if (error) throw error
}

async function main() {
  const client = await findUser('client@skatryk.com') || await findUser('client@skatryk.co.ke')
  const trainer = await findUser('trainer@skatryk.com') || await findUser('trainer@skatryk.co.ke')
  const adminUser = await findUser('admin@skatryk.com') || await findUser('admin@skatryk.co.ke')

  if (!client || !trainer || !adminUser) {
    console.warn('Warning: some seed users are missing', { client: !!client, trainer: !!trainer, admin: !!adminUser })
  }

  if (client) await ensureProfile(client.id, 'client', 'Seed Client')
  if (trainer) await ensureProfile(trainer.id, 'trainer', 'Seed Trainer')
  if (adminUser) await ensureProfile(adminUser.id, 'admin', 'Seed Admin')

  // Categories
  const categories = [
    { name: 'Skating', icon: '⛸️', description: 'All skating disciplines' },
    { name: 'Chess', icon: '♟️', description: 'Chess coaching' },
    { name: 'Martial Arts', icon: '🥋', description: 'Martial arts training' },
    { name: 'Dance', icon: '💃', description: 'Dance classes' },
    { name: 'School Tuition', icon: '📚', description: 'Academic tutoring and school subjects' },
    { name: 'Ballet', icon: '🩰', description: 'Ballet lessons and coaching' },
    { name: 'Swimming', icon: '🏊', description: 'Swimming lessons' },
    { name: 'Taekwondo', icon: '🥊', description: 'Taekwondo training' },
  ]
  try {
    await admin.from('categories').upsert(categories, { onConflict: 'name' })
  } catch (e) { console.warn('categories upsert', e.message || e) }

  // Services for trainer
  if (trainer) {
    const services = [
      { trainer_id: trainer.id, title: 'Private Session', price: 50 },
      { trainer_id: trainer.id, title: 'Group Class', price: 30 },
    ]
    try { await admin.from('services').upsert(services, { onConflict: ['trainer_id','title'] }) } catch (e) { console.warn('services upsert', e.message || e) }
  }

  // Bookings for client/trainer
  if (client && trainer) {
    const today = new Date()
    const dateStr = (d) => d.toISOString().slice(0,10)
    const upcoming = new Date(today.getTime() + 86400000)
    const past = new Date(today.getTime() - 86400000)
    const bookings = [
      { client_id: client.id, trainer_id: trainer.id, session_date: dateStr(upcoming), session_time: '10:00', duration_hours: 1, total_sessions: 1, status: 'confirmed', total_amount: 50, notes: 'Seed booking' },
      { client_id: client.id, trainer_id: trainer.id, session_date: dateStr(past), session_time: '09:00', duration_hours: 1, total_sessions: 1, status: 'completed', total_amount: 50, notes: 'Seed completed' },
    ]
    try {
      const { data: inserted } = await admin.from('bookings').insert(bookings).select('*')
      try {
        const completed = (inserted || []).find(b => b.status === 'completed')
        if (completed && completed.id) {
          await admin.from('reviews').insert({ booking_id: completed.id, client_id: client.id, trainer_id: trainer.id, rating: 5, comment: 'Great session!', created_at: new Date().toISOString() })
          await admin.from('payments').insert({ booking_id: completed.id, user_id: client.id, trainer_id: trainer.id, amount: completed.total_amount || 50, status: 'completed', method: 'card', created_at: new Date().toISOString() })
        }
      } catch (e) { console.warn('reviews/payments insert', e.message || e) }
    } catch (e) { console.warn('bookings insert', e.message || e) }
  }

  // Messages
  if (client && trainer) {
    const messages = [
      { trainer_id: trainer.id, client_id: client.id, content: 'Welcome! Looking forward to training.', created_at: new Date().toISOString() },
    ]
    try { await admin.from('messages').insert(messages) } catch (e) { console.warn('messages insert', e.message || e) }
  }

  // Payments
  if (client && trainer) {
    const payments = [ { user_id: client.id, trainer_id: trainer.id, amount: 50, status: 'completed', method: 'card', created_at: new Date().toISOString() } ]
    try { await admin.from('payments').insert(payments) } catch (e) { console.warn('payments insert', e.message || e) }
  }

  // Referrals with savings
  if (client) {
    const referrals = [
      { referrer_id: client.id, code: 'REF-' + Math.random().toString(36).slice(2,8).toUpperCase(), discount_used: true, discount_amount: 12, created_at: new Date().toISOString() },
      { referrer_id: client.id, code: 'REF-' + Math.random().toString(36).slice(2,8).toUpperCase(), discount_used: true, discount_amount: 15, created_at: new Date().toISOString() },
    ]
    try { await admin.from('referrals').insert(referrals) } catch (e) { console.warn('referrals insert', e.message || e) }
  }

  // Notifications
  if (client) {
    const notifications = [ { user_id: client.id, title: 'Welcome', body: 'Thanks for joining!', created_at: new Date().toISOString() } ]
    try { await admin.from('notifications').insert(notifications) } catch (e) { console.warn('notifications insert', e.message || e) }
  }

  // Payouts
  if (trainer) {
    const payouts = [ { trainer_id: trainer.id, amount: 150, status: 'paid', requested_at: new Date().toISOString() } ]
    try { await admin.from('payouts').insert(payouts) } catch (e) { console.warn('payouts insert', e.message || e) }
  }

  console.log('Seeding complete')
  process.exit(0)
}

main()
