const { Client } = require('pg')

const conn = process.argv[2] || process.env.DB_CONNECTION || process.env.SUPABASE_DB_URL
const trainerEmail = process.argv[3] || 'trainer@skatryk.com'

if (!conn) {
  console.error('Usage: node scripts/seed_trainer_flow.cjs <connection-string> [trainer-email]')
  process.exit(1)
}

async function run() {
  const needsSSL = /supabase\.(co|com)|neon\.tech|herokuapp\.com|render\.com|aws|amazonaws\.com/i.test(conn)
  const cleanConn = conn.replace(/\?sslmode=require$/i, '')
  const client = new Client({ connectionString: cleanConn, ssl: needsSSL ? { rejectUnauthorized: false } : undefined })
  await client.connect()
  try {
    console.log('Connected to DB')

    // Find trainer user id from auth.users
    const { rows: trainerRows } = await client.query('SELECT id, email FROM auth.users WHERE lower(email)=lower($1) LIMIT 1', [trainerEmail])
    if (!trainerRows || trainerRows.length === 0) {
      console.error('Trainer auth user not found for email:', trainerEmail)
      console.error('Please create the user via Supabase Auth (or share Service Role so we can create it).')
      process.exit(2)
    }
    const trainerId = trainerRows[0].id

    // Upsert trainer profile
    const profileUpsert = `
      INSERT INTO public.user_profiles (user_id, user_type, full_name, bio, hourly_rate, disciplines, rating, total_reviews, is_approved)
      VALUES ($1, 'trainer', 'Seed Trainer', 'Seeded trainer profile', 50, '["Skating","Ballet"]'::jsonb, 4.8, 0, true)
      ON CONFLICT (user_id) DO UPDATE SET
        user_type=EXCLUDED.user_type,
        full_name=EXCLUDED.full_name,
        bio=EXCLUDED.bio,
        hourly_rate=EXCLUDED.hourly_rate,
        disciplines=EXCLUDED.disciplines,
        is_approved=EXCLUDED.is_approved
    `
    await client.query(profileUpsert, [trainerId])
    console.log('Trainer profile ensured for', trainerEmail)

    // Ensure categories
    const categories = [
      ['Skating','⛸️','All skating disciplines'],
      ['Ballet','🩰','Ballet lessons and coaching'],
      ['Taekwondo','🥊','Taekwondo training'],
      ['Dance','💃','Dance classes'],
    ]
    for (const [name, icon, description] of categories) {
      await client.query(
        'INSERT INTO public.categories (name, icon, description) VALUES ($1,$2,$3) ON CONFLICT (name) DO UPDATE SET icon=EXCLUDED.icon, description=EXCLUDED.description',
        [name, icon, description]
      )
    }
    console.log('Categories ensured')

    // Ensure a default service for the trainer
    await client.query(
      'INSERT INTO public.services (trainer_id, title, price, description) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [trainerId, 'Private Session', 50, 'One-on-one session']
    )
    console.log('Service ensured')

    // Seed a referral code
    const code = 'REF-T-' + Math.random().toString(36).slice(2,7).toUpperCase()
    await client.query(
      'INSERT INTO public.referrals (referrer_id, code, created_at) VALUES ($1,$2, now()) ON CONFLICT (code) DO NOTHING',
      [trainerId, code]
    )
    console.log('Referral created (or exists):', code)

    console.log('Seeding completed successfully')
  } catch (err) {
    console.error('Seeding failed', err)
    process.exit(3)
  } finally {
    try { await client.end() } catch {}
  }
}

run()
