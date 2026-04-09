#!/usr/bin/env node
/*
  MySQL migration via external PHP API (https://events.skatryk.co.ke/api.php)

  Usage:
    node scripts/mysql_migrate_via_api.mjs [--api=https://events.skatryk.co.ke/api.php] [--plan=scripts/mysql_migration_plan.json]

  Plan file format (JSON):
    {
      "tables": [
        {
          "name": "table_name",                       // deprecated alias for source/target
          "source": "source_table_name",              // defaults to name
          "target": "target_table_name",              // defaults to name
          "where": "optional WHERE clause without the 'WHERE' keyword",
          "columns": ["id INT AUTO_INCREMENT PRIMARY KEY", "name VARCHAR(255)"]
        }
      ]
    }

  Notes:
  - If "columns" is provided for a table, those will be used for CREATE TABLE.
  - If "columns" is omitted, the script will infer a schema from the selected data.
  - For empty tables without provided columns, table creation will be skipped because types cannot be inferred.
*/

import fs from 'fs'
import path from 'path'

const argv = process.argv.slice(2)
const apiArg = argVal('--api')
const planArg = argVal('--plan')
const apiUrl = apiArg || 'https://events.skatryk.co.ke/api.php'
const planPath = planArg || 'scripts/mysql_migration_plan.json'

function argVal(flag) {
  const found = argv.find(a => a.startsWith(flag+'='))
  return found ? found.split('=').slice(1).join('=') : null
}

async function apiCall(body) {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json().catch(() => ({}))
  if (!json || json.status !== 'success') {
    const msg = json && json.message ? json.message : 'Unknown API error'
    throw new Error(`API error: ${msg}`)
  }
  return json.data
}

function isInt(val) {
  if (val === null || val === undefined || val === '') return false
  if (typeof val === 'number') return Number.isInteger(val)
  if (typeof val === 'string') return /^-?\d+$/.test(val)
  return false
}

function isDecimal(val) {
  if (val === null || val === undefined || val === '') return false
  if (typeof val === 'number') return !Number.isNaN(val) && !Number.isInteger(val)
  if (typeof val === 'string') return /^-?\d+\.\d+$/.test(val)
  return false
}

function isDateTime(val) {
  if (typeof val !== 'string') return false
  // Accept common MySQL datetime/date formats
  if (/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}:\d{2})?$/.test(val)) return true
  if (/^\d{2}\/\d{2}\/\d{4}( \d{2}:\d{2}:\d{2})?$/.test(val)) return true
  return false
}

function inferColumnType(values) {
  // Prefer the widest necessary type across all values
  let anyText = false
  let anyDatetime = false
  let anyDecimal = false
  let anyInt = false
  let maxLen = 0

  for (const v of values) {
    if (v === null || v === undefined) continue
    const s = typeof v === 'string' ? v : String(v)
    if (s.length > maxLen) maxLen = s.length
    if (isInt(v)) { anyInt = true; continue }
    if (isDecimal(v)) { anyDecimal = true; continue }
    if (isDateTime(s)) { anyDatetime = true; continue }
    anyText = true
  }

  if (anyText) {
    // Use TEXT if any values exceed 255 or contain newlines, else VARCHAR(255)
    return maxLen > 255 || values.some(v => typeof v === 'string' && /\n|\r/.test(v)) ? 'TEXT' : 'VARCHAR(255)'
  }
  if (anyDatetime) return 'DATETIME'
  if (anyDecimal) return 'DECIMAL(15,4)'
  if (anyInt) return 'INT'
  return 'VARCHAR(255)'
}

function buildCreateColumns(rows, providedColumns) {
  if (Array.isArray(providedColumns) && providedColumns.length) {
    return providedColumns
  }
  if (!rows || rows.length === 0) return null

  // Aggregate values per key
  const byKey = new Map()
  for (const r of rows) {
    for (const [k, v] of Object.entries(r)) {
      if (!byKey.has(k)) byKey.set(k, [])
      byKey.get(k).push(v)
    }
  }

  const cols = []
  const keys = Array.from(byKey.keys())

  // Prefer explicit id primary key if present
  if (keys.includes('id')) {
    const idType = inferColumnType(byKey.get('id'))
    if (idType === 'INT') cols.push('id INT AUTO_INCREMENT PRIMARY KEY')
    else cols.push('id VARCHAR(191) PRIMARY KEY')
  }

  for (const k of keys) {
    if (k === 'id') continue
    const t = inferColumnType(byKey.get(k))
    cols.push(`\`${k}\` ${t}`)
  }
  return cols
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function migrateTable(table) {
  const source = table.source || table.name
  const target = table.target || table.name
  const where = table.where || ''
  process.stdout.write(`\n→ Migrating ${source} → ${target} ...\n`)

  // 1) Fetch data from source
  const data = await apiCall({ action: 'select', table: source, ...(where ? { where } : {}) })
  const rows = Array.isArray(data) ? data : []
  process.stdout.write(`Fetched ${rows.length} row(s) from ${source}\n`)

  // 2) Build/create target table
  const createCols = buildCreateColumns(rows, table.columns)
  if (!createCols) {
    process.stdout.write(`No rows and no schema provided for ${target}, skipping table creation.\n`)
  } else {
    await apiCall({ action: 'create_table', table: target, columns: createCols })
    process.stdout.write(`Ensured table ${target} exists\n`)
  }

  if (rows.length === 0) return

  // 3) Seed data into target in chunks
  const batches = chunk(rows, 100)
  let inserted = 0
  for (const b of batches) {
    await apiCall({ action: 'seed', table: target, data: b })
    inserted += b.length
    process.stdout.write(`Inserted ${inserted}/${rows.length} into ${target}\r`)
  }
  process.stdout.write(`\nFinished ${target}: ${inserted} row(s)\n`)
}

function readPlan(p) {
  const full = path.resolve(p)
  if (!fs.existsSync(full)) {
    throw new Error(`Plan file not found at ${p}`)
  }
  const json = JSON.parse(fs.readFileSync(full, 'utf8'))
  if (!json || !Array.isArray(json.tables)) {
    throw new Error('Plan file must contain { "tables": [...] }')
  }
  return json
}

async function main() {
  console.log(`Using API: ${apiUrl}`)
  console.log(`Using plan: ${planPath}`)
  const plan = readPlan(planPath)
  for (const t of plan.tables) {
    await migrateTable(t)
  }
  console.log('\nAll done')
}

main().catch(err => {
  console.error('Migration failed:', err && err.message ? err.message : err)
  process.exit(1)
})
