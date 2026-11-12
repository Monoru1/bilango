import { afterEach, describe, expect, it } from 'vitest';
import { createPgliteDb, migrate, migrationFiles } from '../src/db';
import { decideRecetteMigration, inspectRecetteDb, migrateRecette } from '../src/recette-migration-guard';

const open: { close(): Promise<void> }[] = [];
afterEach(async () => { for (const db of open.splice(0)) await db.close(); });
async function fresh() { const db = await createPgliteDb(); open.push(db); return db; }

describe('garde des migrations de recette', () => {
  it('initialise une base réellement vide et journalise uniquement des compteurs', async () => {
    const db = await fresh();
    const lines: string[] = [];
    const applied = await migrateRecette(db, {}, (l) => lines.push(l));
    expect(applied).toEqual(await migrationFiles());
    expect(lines).toEqual(['[recette] base : tables=0 tables_avec_donnees=0 migrations_appliquees=aucune_table en_attente=' + applied.length + ' decision=initialize']);
  });

  it('ne migre rien sur une base déjà à jour', async () => {
    const db = await fresh();
    await migrate(db);
    const lines: string[] = [];
    expect(await migrateRecette(db, {}, (l) => lines.push(l))).toEqual([]);
    expect(lines[0]).toMatch(/en_attente=0 decision=up_to_date$/);
  });

  it('refuse, sans rien écrire, une base non vide avec des migrations en attente', async () => {
    const db = await fresh();
    await migrate(db);
    const last = (await migrationFiles()).at(-1)!;
    await db.query('delete from schema_migrations where name = $1', [last]);
    const lines: string[] = [];
    await expect(migrateRecette(db, {}, (l) => lines.push(l))).rejects.toThrow('recette_database_not_empty_backup_required');
    expect(lines[0]).toMatch(/en_attente=1 decision=refus$/);
    expect((await db.query('select 1 from schema_migrations where name = $1', [last])).rows).toHaveLength(0);
    await expect(migrateRecette(db, { RECETTE_MIGRATION_APPROVED_UP_TO: 'autre.sql' }, () => undefined)).rejects.toThrow('recette_database_not_empty_backup_required');
  });

  it('refuse une base contenant des tables étrangères sans historique de migrations', async () => {
    const db = await fresh();
    await db.exec('create table inconnue (id int)');
    await expect(migrateRecette(db, { RECETTE_MIGRATION_APPROVED_UP_TO: (await migrationFiles()).at(-1) }, () => undefined)).rejects.toThrow('recette_database_not_empty_backup_required');
    expect((await inspectRecetteDb(db)).tables).toBe(1);
  });

  it('compte les tables qui portent des données et reste en lecture seule', async () => {
    const db = await fresh();
    await db.exec('create table a (id int); create table b (id int); insert into a values (1)');
    expect(await inspectRecetteDb(db)).toMatchObject({ tables: 2, tablesWithRows: 1, applied: null });
  });

  it('n’accepte une approbation que pour le dernier fichier en attente', () => {
    const state = { tables: 12, tablesWithRows: 3, applied: ['001.sql'], pending: ['002.sql', '003.sql'] };
    expect(decideRecetteMigration(state, '003.sql')).toBe('approved');
    for (const v of [undefined, '', 'true', '002.sql']) expect(() => decideRecetteMigration(state, v)).toThrow();
  });
});
