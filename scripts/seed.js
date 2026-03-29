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
    console.log('Seeding user_profiles...')
    const trainers = [
      {
        user_id: 'trainer_1',
        user_type: 'trainer',
        full_name: 'Sarah Johnson',
        profile_image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
        bio: 'Experienced ballet trainer with 10+ years of professional experience. Specializing in classical ballet and contemporary dance.',
        disciplines: ['Ballet'],
        certifications: ['Ballet Academy Cert'],
        hourly_rate: 45,
        service_radius: 5,
        availability: { monday: ['09:00-12:00', '14:00-18:00'] },
        rating: 4.9,
        total_reviews: 127,
        is_approved: true,
      },
      {
        user_id: 'trainer_2',
        user_type: 'trainer',
        full_name: 'Mike Chen',
        profile_image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
        bio: 'Certified martial arts coach and Black Belt. Training in Karate, Taekwondo, and Kung Fu.',
        disciplines: ['Martial Arts'],
        certifications: ['Black Belt'],
        hourly_rate: 60,
        service_radius: 10,
        availability: { tuesday: ['10:00-16:00'] },
        rating: 4.8,
        total_reviews: 89,
        is_approved: true,
      }
    ]

    const clients = [
      {
        user_id: 'client_1',
        user_type: 'client',
        full_name: 'Alice Johnson',
        phone_number: '+10000000001',
      },
      {
        user_id: 'client_2',
        user_type: 'client',
        full_name: 'Bob Smith',
        phone_number: '+10000000002',
      }
    ]

    await admin.from('user_profiles').upsert([...trainers, ...clients], { onConflict: 'user_id' })
    console.log('user_profiles seeded')

    console.log('Seeding services...')
    const services = [
      { trainer_id: 'trainer_1', title: 'Ballet Private Lesson', price: 45 },
      { trainer_id: 'trainer_2', title: 'Taekwondo Beginner', price: 60 }
    ]
    try {
      await admin.from('services').upsert(services, { onConflict: ['trainer_id', 'title'] })
      console.log('services seeded')
    } catch (e) {
      console.warn('services upsert', e.message || e)
    }

    console.log('Seeding bookings...')
    const bookings = [
      { client_id: 'client_1', trainer_id: 'trainer_1', session_date: '2025-10-01', session_time: '10:00', duration_hours: 1, total_sessions: 1, status: 'pending', total_amount: 45, notes: 'Looking forward' },
      { client_id: 'client_2', trainer_id: 'trainer_2', session_date: '2025-10-02', session_time: '14:00', duration_hours: 1.5, total_sessions: 1, status: 'confirmed', total_amount: 90 }
    ]
    try {
      await admin.from('bookings').insert(bookings)
      console.log('bookings seeded')
    } catch (e) {
      console.warn('bookings insert', e.message || e)
    }

    console.log('Seeding messages...')
    const messages = [
      { trainer_id: 'trainer_1', client_id: 'client_1', content: 'Hi, looking forward to our session', created_at: new Date().toISOString() },
      { trainer_id: 'trainer_2', client_id: 'client_2', content: 'Please confirm the time', created_at: new Date().toISOString() }
    ]
    try {
      await admin.from('messages').insert(messages)
      console.log('messages seeded')
    } catch (e) {
      console.warn('messages insert', e.message || e)
    }

    console.log('Seeding payments...')
    const payments = [
      { user_id: 'client_2', trainer_id: 'trainer_2', amount: 90, status: 'completed', method: 'card', created_at: new Date().toISOString() }
    ]
    try {
      await admin.from('payments').insert(payments)
      console.log('payments seeded')
    } catch (e) {
      console.warn('payments insert', e.message || e)
    }

    console.log('Seeding notifications...')
    const notifications = [
      { user_id: 'trainer_1', title: 'Welcome', body: 'Thanks for joining TrainerTrove', created_at: new Date().toISOString() }
    ]
    try {
      await admin.from('notifications').insert(notifications)
      console.log('notifications seeded')
    } catch (e) {
      console.warn('notifications insert', e.message || e)
    }

    console.log('Seeding payouts table sample')
    const payouts = [
      { trainer_id: 'trainer_2', amount: 150, status: 'paid', requested_at: new Date().toISOString() }
    ]
    try {
      await admin.from('payouts').insert(payouts)
      console.log('payouts seeded')
    } catch (e) {
      console.warn('payouts insert', e.message || e)
    }

    console.log('Seeding complete')
    process.exit(0)
  } catch (err) {
    console.error('Seed error', err)
    process.exit(1)
  }
}

main()
