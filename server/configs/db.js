import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { neon } from '@neondatabase/serverless'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Load env before initializing the Neon client so imports work reliably. */
dotenv.config({ path: path.join(__dirname, '..', '.env') })

/**
 * Neon pooler URLs often include channel_binding=require. Some Node/OpenSSL setups
 * report TLS/handshake failures; dropping this param keeps sslmode=require intact.
 */
function normalizeDatabaseUrl(raw) {
  if (raw == null || typeof raw !== 'string') return null
  const trimmed = raw.trim().replace(/^['"]+|['"]+$/g, '')
  if (!trimmed) return null
  try {
    const u = new URL(trimmed)
    u.searchParams.delete('channel_binding')
    return u.toString()
  } catch {
    return trimmed
  }
}

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL)

function missingDb(strings, ...values) {
  void strings
  void values
  return Promise.reject(
    new Error(
      'DATABASE_URL is not set or invalid. Add a Postgres connection string to server/.env (e.g. from Neon Dashboard).'
    )
  )
}

/** @type {import('@neondatabase/serverless').NeonQueryFunction<boolean, boolean>} */
const sql = databaseUrl ? neon(databaseUrl) : missingDb

if (!databaseUrl) {
  console.warn(
    '[db] DATABASE_URL is missing — database routes will fail until it is configured.'
  )
}

export default sql
export { databaseUrl }
