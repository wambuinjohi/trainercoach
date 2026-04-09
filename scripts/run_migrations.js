const fs = require('fs')
const { Client } = require('pg')

const conn = process.argv[2] || process.env.DB_CONNECTION || process.env.SUPABASE_DB_URL
if (!conn) {
  console.error('Usage: node run_migrations.js <connection-string>')
  process.exit(1)
}

const sql = fs.readFileSync('scripts/migrations.sql', 'utf8')

async function run() {
  const needsSSL = /supabase\.(co|com)|neon\.tech|herokuapp\.com|render\.com|aws|amazonaws\.com/i.test(conn)
const client = new Client({ connectionString: conn, ssl: needsSSL ? { rejectUnauthorized: false } : undefined })
  try {
    await client.connect()
    console.log('Connected to DB')
    const parts = sql.split(/;\s*\n/).map(s=>s.trim()).filter(Boolean)
    for (const p of parts) {
      try {
        console.log('Executing statement...')
        await client.query(p)
      } catch (err) {
        console.error('Statement failed:', err && err.message ? err.message : err)
      }
    }
    console.log('Migrations complete')
  } catch (err) {
    console.error('Migration runner failed', err)
  } finally {
    try { await client.end() } catch (e) {}
  }
}

run()
