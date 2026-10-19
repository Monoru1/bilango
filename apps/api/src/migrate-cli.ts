import { createPgDb, migrate } from './db';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL requis.');
  process.exit(1);
}
const db = await createPgDb(url);
process.stdout.write(`Migrations appliquées : ${(await migrate(db)).join(', ') || 'aucune (déjà à jour)'}\n`);
await db.close();
