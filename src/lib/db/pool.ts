import { Pool } from "pg";

// A single shared pg Pool. In serverless (Vercel) point DATABASE_URL at the
// Supabase connection pooler (port 6543) so we do not exhaust connections.
// Locally it points at the dev Postgres. The pool is cached on globalThis so
// hot reloads in dev do not open a new pool every time.
const globalForPool = globalThis as unknown as { _auricPool?: Pool };

export function getPool(): Pool {
  if (!globalForPool._auricPool) {
    // Accept POSTGRES_URL too, so the Vercel Postgres (Neon) integration works
    // without copying its connection string into a separate variable.
    const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL (or POSTGRES_URL) is not set");
    }
    globalForPool._auricPool = new Pool({
      connectionString,
      // Supabase requires SSL; allow self-signed in the managed environment.
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return globalForPool._auricPool;
}

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}
