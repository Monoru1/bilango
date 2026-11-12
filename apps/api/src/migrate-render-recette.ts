import { createPgDb, migrate } from './db';
import { renderRecetteTarget } from './render-recette-target';

// One-shot command, no HTTP listener. The target is limited to the dedicated private database.
const db = await createPgDb(renderRecetteTarget(process.env.DATABASE_URL).toString());
try {
  const applied = await migrate(db);
  process.stdout.write(`[recette] migrations applied: ${applied.length}\n`);
} finally {
  await db.close();
}
