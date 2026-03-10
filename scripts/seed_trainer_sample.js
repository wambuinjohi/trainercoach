import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

async function main() {
  try {
    const { data: trainers } = await admin.from('user_profiles').select('*').eq('user_type', 'trainer').limit(10)
    if (!trainers || trainers.length === 0) {
      console.warn('No trainers found to seed')
      return
    }
    const t = trainers[0]
    console.log('Seeding sample data for trainer', t.user_id || t.full_name)

    // Upsert richer profile
    const profileUpdate = {
      user_id: t.user_id,
      full_name: t.full_name || 'Trainer Sample',
      bio: 'Sample trainer seeded for dashboard audit',
      hourly_rate: 45,
      disciplines: ['Dance','Ballet'],
      rating: 4.8,
      total_reviews: 12,
      profile_image: null,
      is_approved: true,
    }
    const profRes = await admin.from('user_profiles').upsert(profileUpdate, { onConflict: 'user_id' })
    console.log('profile upsert result:', profRes.error ? profRes.error : 'ok')

    // Ensure there are client users to reference
    let clientIds = []
    try {
      const { data: clients } = await admin.from('user_profiles').select('user_id').eq('user_type', 'client').limit(2)
      clientIds = (clients || []).map(c=>c.user_id).filter(Boolean)
    } catch (e) { clientIds = [] }

    while (clientIds.length < 2) {
      const email = `seedclient${clientIds.length+1}@skatryk.local`
      try {
        const { data } = await admin.auth.admin.createUser({ email, password: 'Test1234', email_confirm: true })
        const uid = data.user?.id
        if (uid) {
          await admin.from('user_profiles').upsert({ user_id: uid, user_type: 'client', full_name: `Seed Client ${clientIds.length+1}` }, { onConflict: 'user_id' })
          clientIds.push(uid)
        }
      } catch (e) { console.warn('create client failed', e.message || e); break }
    }

    // Services
    const services = [
      { trainer_id: t.user_id, title: 'Ballet Private Lesson', price: 45 },
      { trainer_id: t.user_id, title: 'Group Dance Class', price: 30 },
    ]
    for (const s of services) {
      try {
        await admin.from('services').insert(s)
      } catch (e) {
        // ignore duplicates
      }
    }
    console.log('services ensured')

    // Bookings
    const today = new Date()
    const dateStr = (d) => d.toISOString().slice(0,10)
    const upcoming = new Date(today.getTime() + 86400000)
    const past = new Date(today.getTime() - 86400000)
    const bookings = [
      { client_id: clientIds[0], trainer_id: t.user_id, session_date: dateStr(upcoming), session_time: '10:00', duration_hours: 1, total_sessions: 1, status: 'confirmed', total_amount: 45, notes: 'Upcoming seeded booking' },
      { client_id: clientIds[1], trainer_id: t.user_id, session_date: dateStr(past), session_time: '09:00', duration_hours: 1, total_sessions: 2, status: 'completed', total_amount: 90, notes: 'Past completed session' },
    ]
    const bookRes = await admin.from('bookings').insert(bookings).select()
    console.log('bookings insert:', bookRes.error ? bookRes.error : (bookRes.data || []).length + ' inserted')

    // Messages
    const messages = [
      { trainer_id: t.user_id, client_id: clientIds[0], content: 'Looking forward to our session!', created_at: new Date().toISOString() },
      { trainer_id: t.user_id, client_id: clientIds[1], content: 'Thanks for the great lesson!', created_at: new Date().toISOString() },
    ]
    const msgRes = await admin.from('messages').insert(messages)
    console.log('messages insert:', msgRes.error ? msgRes.error : (msgRes.data || []).length + ' inserted')

    // Payments
    const payments = [
      { user_id: clientIds[1], trainer_id: t.user_id, amount: 90, status: 'completed', method: 'card', created_at: new Date().toISOString() }
    ]
    const payRes = await admin.from('payments').insert(payments)
    console.log('payments insert:', payRes.error ? payRes.error : (payRes.data || []).length + ' inserted')

    // Payouts
    const payouts = [ { trainer_id: t.user_id, amount: 100, status: 'paid', requested_at: new Date().toISOString() } ]
    const payoutRes = await admin.from('payouts').insert(payouts)
    console.log('payouts insert:', payoutRes.error ? payoutRes.error : (payoutRes.data || []).length + ' inserted')

    // Review for completed booking: attach to most recent completed booking if exists
    try {
      const { data: completed } = await admin.from('bookings').select('*').eq('trainer_id', t.user_id).eq('status', 'completed').order('session_date', { ascending: false }).limit(1).maybeSingle()
      if (completed && completed.id) {
        await admin.from('reviews').upsert({ booking_id: completed.id, client_id: completed.client_id, trainer_id: t.user_id, rating: 5, comment: 'Excellent trainer!', created_at: new Date().toISOString() }, { onConflict: ['booking_id'] })
      }
    } catch (e) { console.warn('review upsert', e.message || e) }

    console.log('Seeding detailed trainer sample completed')
  } catch (err) {
    console.error('Seed trainer sample failed', err)
  }
}

main()
