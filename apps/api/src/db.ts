import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  /** Exécute un script SQL multi-instructions (migrations). Sans paramètres. */
  exec(sql: string): Promise<void>;
  /** Exécute `fn` dans une transaction ; annule tout si `fn` lève. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/**
 * Moteur PostgreSQL embarqué (WASM) : vrai SQL PostgreSQL 17 pour les tests et le
 * développement local, sans serveur à installer. La production utilise `createPgDb`.
 * Limite : une seule connexion — les vraies courses entre transactions concurrentes ne sont
 * pas reproduites ici et doivent être rejouées sur PostgreSQL en CI (docs/TEST_REPORT.md).
 */
export async function createPgliteDb(): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite();
  type Queryable = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>; exec: (sql: string) => Promise<unknown> };
  const wrap = (q: Queryable, tx: (fn: (inner: Db) => Promise<unknown>) => Promise<unknown>): Db => ({
    query: (sql, params) => q.query(sql, params) as Promise<{ rows: never[] }>,
    exec: async (sql) => {
      await q.exec(sql);
    },
    tx: (fn) => tx(fn as (inner: Db) => Promise<unknown>) as Promise<never>,
  });
  const nested = (q: Queryable): Db =>
    wrap(q, async (fn) => fn(nested(q))); // pas de sous-transaction : on réutilise celle en cours
  return wrap(pg as unknown as Queryable, (fn) => pg.transaction((t) => fn(nested(t as unknown as Queryable))));
}

export async function createPgDb(connectionString: string): Promise<Db & { close(): Promise<void> }> {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString, max: 10 });
  const wrap = (client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }, inTx: boolean): Db => ({
    query: (sql, params) => client.query(sql, params) as Promise<{ rows: never[] }>,
    exec: async (sql) => {
      await client.query(sql);
    },
    tx: async (fn) => {
      if (inTx) return fn(wrap(client, true));
      const c = await pool.connect();
      try {
        await c.query('begin');
        const result = await fn(wrap(c, true));
        await c.query('commit');
        return result;
      } catch (e) {
        await c.query('rollback');
        throw e;
      } finally {
        c.release();
      }
    },
  });
  return { ...wrap(pool, false), close: () => pool.end() };
}

/** Applique, dans l'ordre, les fichiers `migrations/*.sql` non encore appliqués. */
export async function migrate(db: Db): Promise<string[]> {
  await db.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const applied = new Set((await db.query<{ name: string }>('select name from schema_migrations')).rows.map((r) => r.name));
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  const done: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    await db.tx(async (t) => {
      await t.exec(sql);
      await t.query('insert into schema_migrations(name) values ($1)', [file]);
    });
    done.push(file);
  }
  return done;
}
