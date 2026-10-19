import { createPgDb, migrate } from './db';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL requis.');
  process.exit(1);
}
const db = await createPgDb(url);
console.log('Migrations appliquées :', (await migrate(db)).join(', ') || 'aucune (déjà à jour)');
await db.close();
