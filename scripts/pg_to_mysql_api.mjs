#!/usr/bin/env node
import fs from 'fs'
import { Client } from 'pg'
import path from 'path'

const argv = process.argv.slice(2)
function argVal(flag) {
  const found = argv.find(a => a.startsWith(flag + '='))
  return found ? found.split('=').slice(1).join('=') : null
}

const pgConn = argVal('--pg') || process.env.DB_CONNECTION || process.env.PG_CONN || process.env.SUPABASE_DB_URL
const apiUrl = argVal('--api') || process.env.API_URL || 'https://events.skatryk.co.ke/api.php'
const batchSize = Number(argVal('--batch') || process.env.BATCH_SIZE || 200)

if (!pgConn) {
  console.error('Usage: node scripts/pg_to_mysql_api.mjs --pg=<postgres-connection-string> [--api=<api-url>]')
  process.exit(1)
}

async function apiCall(body) {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json().catch(() => ({}))
  if (!json || json.status !== 'success') throw new Error(`API error: ${json && json.message ? json.message : 'unknown'}`)
  return json.data
}

function mapPgType(pgType, charMaxLength) {
  if (!pgType) return 'VARCHAR(255)'
  pgType = pgType.toLowerCase()
  if (pgType.includes('int')) return 'INT'
  if (pgType === 'bigint') return 'BIGINT'
  if (pgType === 'smallint') return 'SMALLINT'
  if (pgType === 'uuid') return 'VARCHAR(191)'
  if (pgType === 'boolean') return 'TINYINT(1)'
  if (pgType === 'text') return 'TEXT'
  if (pgType === 'json' || pgType === 'jsonb') return 'JSON'
  if (pgType.includes('timestamp') || pgType === 'date' || pgType === 'timestamptz') return 'DATETIME'
  if (pgType === 'numeric' || pgType === 'decimal') return 'DECIMAL(15,4)'
  if (pgType === 'real' || pgType === 'double precision') return 'DOUBLE'
  if (pgType === 'bytea') return 'BLOB'
  if (pgType.startsWith('character') || pgType.startsWith('varchar')) {
    const len = charMaxLength ? Number(charMaxLength) : 255
    return `VARCHAR(${Math.min(len || 255, 65535)})`
  }
  // fallback
  return 'VARCHAR(255)'
}

function serializeValue(val) {
  if (val === null || val === undefined) return null
  if (Buffer.isBuffer(val)) return val.toString('base64')
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function migrate() {
  const client = new Client({ connectionString: pgConn })
  try {
    await client.connect()
    console.log('Connected to Postgres')

    const tablesRes = await client.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type='BASE TABLE'")
    const tables = tablesRes.rows.map(r => r.table_name)
    console.log(`Found ${tables.length} tables in public schema`)

    for (const table of tables) {
      console.log(`\n→ Migrating table: ${table}`)

      // Get column info
      const colRes = await client.query(
        `SELECT column_name, data_type, character_maximum_length, is_nullable
         FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1
         ORDER BY ordinal_position`,
        [table]
      )
      const cols = colRes.rows

      // Get primary key
      const pkRes = await client.query(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1 AND tc.table_schema='public'`,
        [table]
      )
      const pkCols = pkRes.rows.map(r => r.column_name)

      // Build create columns
      const createCols = []
      for (const c of cols) {
        const mapped = mapPgType(c.data_type, c.character_maximum_length)
        const nullable = c.is_nullable === 'YES' ? '' : ' NOT NULL'
        const colDef = `\`${c.column_name}\` ${mapped}${nullable}`
        createCols.push(colDef)
      }

      // Add primary key if exists
      if (pkCols.length === 1) {
        const pk = pkCols[0]
        // try to set AUTO_INCREMENT for int types
        const colInfo = cols.find(x => x.column_name === pk)
        const mapped = mapPgType(colInfo.data_type, colInfo.character_maximum_length)
        if (mapped === 'INT' || mapped === 'BIGINT' || mapped === 'SMALLINT') {
          // replace definition for pk to include AUTO_INCREMENT PRIMARY KEY
          for (let i = 0; i < createCols.length; i++) {
            if (createCols[i].startsWith(`\`${pk}\``)) {
              createCols[i] = `\`${pk}\` ${mapped} AUTO_INCREMENT PRIMARY KEY`
              break
            }
          }
        } else {
          // set as primary key
          createCols.push(`PRIMARY KEY (\`${pk}\`)`)
        }
      } else if (pkCols.length > 1) {
        // composite key
        const colsEsc = pkCols.map(c => `\`${c}\``).join(', ')
        createCols.push(`PRIMARY KEY (${colsEsc})`)
      }

      // Call API to create table
      try {
        await apiCall({ action: 'create_table', table, columns: createCols })
        console.log(`Created/ensured table ${table}`)
      } catch (err) {
        console.error('Create table failed:', err.message)
        // continue to attempt seeding
      }

      // Fetch rows
      const rowsRes = await client.query(`SELECT * FROM public.\"${table}\"`)
      const rows = rowsRes.rows
      console.log(`Fetched ${rows.length} row(s) from ${table}`)
      if (rows.length === 0) continue

      // normalize rows for API
      const normalized = rows.map(r => {
        const out = {}
        for (const [k, v] of Object.entries(r)) {
          out[k] = serializeValue(v)
        }
        return out
      })

      const batches = chunk(normalized, batchSize)
      let inserted = 0
      for (const b of batches) {
        try {
          await apiCall({ action: 'seed', table, data: b })
          inserted += b.length
          process.stdout.write(`Inserted ${inserted}/${rows.length} into ${table}\r`)
        } catch (err) {
          console.error('\nSeed batch failed for table', table, err.message)
          // try inserting rows individually to isolate bad rows
          for (const row of b) {
            try {
              await apiCall({ action: 'insert', table, data: row })
              inserted++
            } catch (e) {
              console.error('Row insert failed (skipping):', e.message)
            }
          }
        }
      }
      console.log(`\nFinished ${table}: inserted ${inserted} row(s)`)
    }

    console.log('\nAll tables migrated')
  } finally {
    try { await client.end() } catch (e) {}
  }
}

migrate().catch(err => {
  console.error('Migration error:', err && err.message ? err.message : err)
  process.exit(1)
})
