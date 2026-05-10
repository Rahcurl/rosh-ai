import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { clerkMiddleware, requireAuth } from '@clerk/express'
import aiRouter from './routes/aiRoutes.js';
import connectCloudinary from './configs/cloudinary.js';
import userRouter from './routes/userRoutes.js';
import newsletterRouter from './routes/newsletterRoutes.js';
import sql, { databaseUrl } from './configs/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express()

await connectCloudinary()

/**
 * Older DBs used INTEGER/SERIAL ids; this app inserts TEXT UUIDs (`creations.id`) and TEXT
 * Clerk ids (`user_id`). `likes` was sometimes INTEGER[] — likes from Clerk would also error.
 *
 * Migrate every matching table in ALL non-system schemas (not only `public`).
 * Optional ONE-TIME hammer: FORCE_RECREATE_PUBLIC_CREATIONS=true (drops `public.creations`, loses rows).
 */
const migrateClerkFriendlyColumnTypes = async () => {
  await sql.unsafe(`
DO $migration$
DECLARE
  r RECORD;
  sch text;
  id_typ name;
  uid_typ name;
  likes_elem_typ name;
  users_id_typ name;
BEGIN
  FOR r IN
    SELECT DISTINCT n.nspname::text AS schema_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND c.relname = 'users'
      AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  LOOP
    sch := r.schema_name;
    SELECT ty.typname INTO users_id_typ
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type ty ON ty.oid = a.atttypid
    WHERE n.nspname = sch
      AND c.relname = 'users'
      AND a.attname = 'id'
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF users_id_typ IS NOT NULL
       AND users_id_typ IN ('int2', 'int4', 'int8', 'oid') THEN
      EXECUTE format(
        'ALTER TABLE %I.users ALTER COLUMN id TYPE TEXT USING id::TEXT',
        sch
      );
    END IF;
  END LOOP;

  FOR r IN
    SELECT DISTINCT n.nspname::text AS schema_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND c.relname = 'creations'
      AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  LOOP
    sch := r.schema_name;

    SELECT ty.typname INTO id_typ
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type ty ON ty.oid = a.atttypid
    WHERE n.nspname = sch
      AND c.relname = 'creations'
      AND a.attname = 'id'
      AND a.attnum > 0
      AND NOT a.attisdropped;

    SELECT ty.typname INTO uid_typ
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type ty ON ty.oid = a.atttypid
    WHERE n.nspname = sch
      AND c.relname = 'creations'
      AND a.attname = 'user_id'
      AND a.attnum > 0
      AND NOT a.attisdropped;

    SELECT et.typname INTO likes_elem_typ
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type ty ON ty.oid = a.atttypid
    JOIN pg_type et ON et.oid = ty.typelem AND ty.typelem <> 0
    WHERE n.nspname = sch
      AND c.relname = 'creations'
      AND a.attname = 'likes'
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF uid_typ IS NOT NULL AND uid_typ IN ('int2', 'int4', 'int8', 'oid') THEN
      EXECUTE format(
        'ALTER TABLE %I.creations ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT',
        sch
      );
    END IF;

    IF id_typ IS NOT NULL AND id_typ IN ('int2', 'int4', 'int8', 'oid') THEN
      EXECUTE format(
        'ALTER TABLE %I.creations ALTER COLUMN id TYPE TEXT USING id::TEXT',
        sch
      );
    END IF;

    IF likes_elem_typ IS NOT NULL AND likes_elem_typ IN ('int2', 'int4', 'int8', 'oid') THEN
      EXECUTE format(
        'ALTER TABLE %I.creations ALTER COLUMN likes TYPE TEXT[] USING CASE WHEN likes IS NULL THEN ARRAY[]::TEXT[] ELSE COALESCE(ARRAY(SELECT x::TEXT FROM unnest(likes) x), ARRAY[]::TEXT[]) END',
        sch
      );
    END IF;
  END LOOP;
END
$migration$;
  `)

  try {
    const rows = await sql`
      SELECT table_schema, column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'creations'
        AND column_name IN ('id', 'user_id', 'likes')
      ORDER BY table_schema, column_name
    `
    for (const r of rows || [])
      console.log(
        `[db] creations.${r.column_name} (${r.table_schema}) → ${r.data_type}`
      )
  } catch (_) {
    /* non-fatal */
  }
}

const prepareDatabase = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      plan TEXT DEFAULT 'free',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `

  if (process.env.FORCE_RECREATE_PUBLIC_CREATIONS === 'true') {
    console.warn(
      '[db] FORCE_RECREATE_PUBLIC_CREATIONS=true — dropping public.creations (all rows in that table lost).'
    )
    await sql.unsafe(`DROP TABLE IF EXISTS public.creations CASCADE`)
  }

  await sql`
    CREATE TABLE IF NOT EXISTS creations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      prompt TEXT,
      content TEXT,
      type TEXT,
      publish BOOLEAN DEFAULT FALSE,
      likes TEXT[] DEFAULT ARRAY[]::TEXT[],
      created_at TIMESTAMP DEFAULT NOW()
    )
  `

  await migrateClerkFriendlyColumnTypes()
}

try {
  if (!databaseUrl) {
    console.error('[db] Cannot run migrations: DATABASE_URL is unset.')
    process.exit(1)
  }
  await prepareDatabase()
  console.log('[db] Connected and schema verified.')
} catch (err) {
  const cause = err?.cause
  console.error('[db] Startup failed:', err?.message ?? err)
  if (cause?.code === 'CERT_HAS_EXPIRED' || String(cause?.message || '').includes('certificate')) {
    console.error('[db] TLS certificate error — try updating Node/OS CA certs; remove channel_binding from DATABASE_URL if still present.')
  }
  process.exit(1)
}

app.use(cors())
app.use(express.json())
app.use(clerkMiddleware())

app.get('/', (req, res)=>res.send('Server is Live!'))

/** Public — must stay above global requireAuth() */
app.use('/api/newsletter', newsletterRouter)

app.use(requireAuth())

app.use('/api/ai', aiRouter)
app.use('/api/user', userRouter)

const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
    console.log('Server is running on port', PORT);
})