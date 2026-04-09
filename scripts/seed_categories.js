import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

async function main() {
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
    const { data, error } = await admin.from('categories').upsert(categories, { onConflict: 'name' }).select('*')
    if (error) throw error
    console.log(`Seeded categories: ${Array.isArray(data) ? data.length : 0}`)
  } catch (e) {
    console.error('Failed to seed categories:', e?.message || e)
    process.exit(1)
  }
}

main()
