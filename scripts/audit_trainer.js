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
    console.log('Trainer count (sample up to 10):', Array.isArray(trainers) ? trainers.length : 0)
    if (!trainers || trainers.length === 0) return
    const t = trainers[0]
    console.log('Sample trainer summary:', { user_id: t.user_id, full_name: t.full_name, hourly_rate: t.hourly_rate, rating: t.rating, total_reviews: t.total_reviews })
    console.log('Sample trainer full object:', t)

    const { data: bookings } = await admin.from('bookings').select('*').eq('trainer_id', t.user_id).order('session_date', { ascending: true })
    console.log('Bookings for sample trainer:', bookings?.length || 0)
    if (bookings && bookings.length > 0) console.log('First bookings (3):', bookings.slice(0,3))

    const { data: reviews } = await admin.from('reviews').select('*').eq('trainer_id', t.user_id)
    console.log('Reviews count:', reviews?.length || 0)
    if (reviews && reviews.length > 0) console.log('Sample review:', reviews[0])

    const { data: payouts } = await admin.from('payouts').select('*').eq('trainer_id', t.user_id)
    console.log('Payouts count:', payouts?.length || 0)

    const { data: messages } = await admin.from('messages').select('*').eq('trainer_id', t.user_id).order('created_at', { ascending: false }).limit(5)
    console.log('Recent messages (up to 5):', messages?.length || 0)
    if (messages && messages.length > 0) console.log(messages)

    const { data: services } = await admin.from('services').select('*').eq('trainer_id', t.user_id)
    console.log('Services count:', services?.length || 0)
    if (services && services.length > 0) console.log('Services sample:', services)

    const { data: referrals } = await admin.from('referrals').select('*').eq('referrer_id', t.user_id)
    console.log('Referrals by trainer:', referrals?.length || 0)

    const { data: payments } = await admin.from('payments').select('*').eq('trainer_id', t.user_id)
    console.log('Payments to trainer:', payments?.length || 0)

  } catch (err) {
    console.error('Audit failed', err)
  }
}

main()
