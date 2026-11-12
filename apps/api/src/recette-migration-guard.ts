import { migrate, migrationFiles, type Db } from './db';

/**
 * Garde des migrations de la recette Render. Le démarrage en mode recette applique les migrations ;
 * cette garde inspecte d'abord la base EN LECTURE SEULE et ne laisse migrer que :
 *  - une base réellement vide (initialisation) ;
 *  - une base déjà à jour (rien à appliquer) ;
 *  - une base existante dont les migrations en attente ont été approuvées nommément, après
 *    sauvegarde, via RECETTE_MIGRATION_APPROVED_UP_TO=<dernier fichier en attente>.
 * Dans tout autre cas, ou si l'état ne peut pas être lu, le démarrage est refusé sans rien écrire.
 */
export interface RecetteDbState {
  tables: number;
  tablesWithRows: number;
  applied: string[] | null;
  pending: string[];
}

export async function inspectRecetteDb(db: Db): Promise<RecetteDbState> {
  const files = await migrationFiles();
  return db.tx(async (t) => {
    await t.query('set transaction read only');
    const tables = (await t.query<{ ident: string; tablename: string }>(
      "select format('%I.%I', schemaname, tablename) as ident, tablename from pg_catalog.pg_tables where schemaname = current_schema() order by tablename",
    )).rows;
    let tablesWithRows = 0;
    for (const table of tables) {
      // Identifiant produit par format('%I') côté serveur : aucune donnée utilisateur dans la requête.
      const has = (await t.query<{ has: boolean }>(`select exists(select 1 from ${table.ident}) as has`)).rows[0]?.has;
      if (has) tablesWithRows += 1;
    }
    const applied = tables.some((x) => x.tablename === 'schema_migrations')
      ? (await t.query<{ name: string }>('select name from schema_migrations order by name')).rows.map((r) => r.name)
      : null;
    const done = new Set(applied ?? []);
    return { tables: tables.length, tablesWithRows, applied, pending: files.filter((f) => !done.has(f)) };
  });
}

export type RecetteMigrationDecision = 'initialize' | 'up_to_date' | 'approved';

export function decideRecetteMigration(state: RecetteDbState, approvedUpTo: string | undefined): RecetteMigrationDecision {
  if (state.tables === 0) return 'initialize';
  if (state.applied !== null && state.pending.length === 0) return 'up_to_date';
  if (state.applied !== null && approvedUpTo && approvedUpTo === state.pending.at(-1)) return 'approved';
  throw new Error('recette_database_not_empty_backup_required');
}

/** Résumé sans donnée sensible : uniquement des compteurs et la décision. */
export function describeRecetteDb(state: RecetteDbState, decision: RecetteMigrationDecision): string {
  return `[recette] base : tables=${state.tables} tables_avec_donnees=${state.tablesWithRows} migrations_appliquees=${state.applied === null ? 'aucune_table' : state.applied.length} en_attente=${state.pending.length} decision=${decision}`;
}

export async function migrateRecette(db: Db, env: Record<string, string | undefined>, log: (line: string) => void): Promise<string[]> {
  const state = await inspectRecetteDb(db);
  let decision: RecetteMigrationDecision;
  try {
    decision = decideRecetteMigration(state, env.RECETTE_MIGRATION_APPROVED_UP_TO);
  } catch (e) {
    log(`[recette] base : tables=${state.tables} tables_avec_donnees=${state.tablesWithRows} migrations_appliquees=${state.applied === null ? 'aucune_table' : state.applied.length} en_attente=${state.pending.length} decision=refus`);
    throw e;
  }
  log(describeRecetteDb(state, decision));
  return decision === 'up_to_date' ? [] : migrate(db);
}
