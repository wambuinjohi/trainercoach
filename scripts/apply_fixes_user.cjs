const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

async function apply(email) {
  try {
    // find user
    const list = await admin.auth.admin.listUsers({ filter: `email.eq.${email}` })
    const authUser = list.data?.users?.[0]
    if (!authUser) { console.error('User not found'); return }
    const uid = authUser.id
    console.log('Found user', uid)

    // find latest completed booking
    const { data: completed } = await admin.from('bookings').select('*').eq('trainer_id', uid).eq('status', 'completed').order('session_date', { ascending: false }).limit(1).maybeSingle()
    if (!completed || !completed.id) {
      console.log('No completed booking found for trainer')
    } else {
      console.log('Completed booking:', completed.id, completed.session_date)
      // check review exists
      const { data: existingReview } = await admin.from('reviews').select('*').eq('booking_id', completed.id).maybeSingle()
      if (existingReview) {
        console.log('Review already exists for booking')
      } else {
        // insert review
        const reviewPayload = {
          booking_id: completed.id,
          client_id: completed.client_id,
          trainer_id: uid,
          rating: 5,
          comment: 'Auto-generated review for demo',
          created_at: new Date().toISOString(),
        }
        const { data: reviewData, error: rErr } = await admin.from('reviews').insert(reviewPayload).select().maybeSingle()
        if (rErr) console.error('Failed to insert review', rErr)
        else console.log('Inserted review', reviewData?.id)
      }

      // recalc aggregates
      try {
        const { data: reviews } = await admin.from('reviews').select('rating').eq('trainer_id', uid)
        const arr = reviews || []
        const total = arr.length
        const avg = total === 0 ? 0 : Math.round((arr.reduce((s, r) => s + Number(r.rating || 0), 0) / total) * 10) / 10
        const { error: upErr } = await admin.from('user_profiles').update({ rating: avg, total_reviews: total }).eq('user_id', uid)
        if (upErr) console.error('Failed update profile aggregates', upErr)
        else console.log('Updated profile aggregates', { avg, total })
      } catch (e) { console.error('Agg calc failed', e) }

      // link payment if exists
      try {
        const { data: payments } = await admin.from('payments').select('*').eq('trainer_id', uid).eq('user_id', completed.client_id).eq('amount', completed.total_amount)
        const candidate = (payments || []).find(p => !p.booking_id)
        if (candidate && candidate.id) {
          const { error: pErr } = await admin.from('payments').update({ booking_id: completed.id }).eq('id', candidate.id)
          if (pErr) console.error('Failed to link payment', pErr)
          else console.log('Linked payment', candidate.id, 'to booking', completed.id)
        } else {
          console.log('No unlink payment found to link')
        }
      } catch (e) { console.error('Payment link failed', e) }
    }

  } catch (err) {
    console.error('Apply fixes failed', err)
  }
}

apply(process.argv[2])
