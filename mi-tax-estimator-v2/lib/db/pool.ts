// Shared Postgres/PostGIS connection pool — Milestone 2.
//
// Reads DATABASE_URL from the server environment only. Never imported
// by client components; only used inside app/api routes and scripts/.
// If DATABASE_URL is not set, importing this module throws — callers
// (app/api/calculate/route.ts) check for the env var first and fall
// back to the mock adapters instead of importing this at all.

import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Set it in your server environment (see .env.example) before using PostGisAdapter."
    );
  }
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}
