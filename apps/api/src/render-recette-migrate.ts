import { createServer } from 'node:http';
import { createPgDb, migrate } from './db';

// Dedicated, empty staging database only. Never use this command for production.
let url: URL;
try {
  url = new URL(process.env.DATABASE_URL || 'invalid:');
} catch {
  throw new Error('dedicated_recette_database_required');
}
if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== 'dpg-dbopc7brjlhs73bjik8g-a' || url.pathname !== '/gobilan_recette') {
  throw new Error('dedicated_recette_database_required');
}
const db = await createPgDb(url.toString());
try {
  const applied = await migrate(db);
  process.stdout.write(`[recette] migrations appliquées : ${applied.length}\n`);
} finally {
  await db.close();
}
const port = Number(process.env.PORT || 10000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid_port');
// No application endpoints, credentials, or database access are exposed.
createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end('GoBilan recette: migration terminee'); }).listen(port, '0.0.0.0');
