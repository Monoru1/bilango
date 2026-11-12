import { createPgDb } from './db';
import { inspectRecetteDb, migrateRecette } from './recette-migration-guard';
import { renderRecetteTarget } from './render-recette-target';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--inspect')) {
  throw new Error('Usage: migrate-render-recette [--inspect]');
}

// Commande privée sans écoute HTTP, limitée à la base Render de recette.
const db = await createPgDb(renderRecetteTarget(process.env.DATABASE_URL).toString());
try {
  if (args[0] === '--inspect') {
    process.stdout.write(JSON.stringify(await inspectRecetteDb(db)) + '\n');
  } else {
    const applied = await migrateRecette(db, process.env, line => process.stdout.write(line + '\n'));
    process.stdout.write(`[recette] migrations applied: ${applied.length}\n`);
  }
} finally {
  await db.close();
}
