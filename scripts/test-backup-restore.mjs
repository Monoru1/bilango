/** CI only: restore a synthetic database into a SECOND disposable database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { createPgDb, migrationFiles } from '../apps/api/src/db.ts';
import { inspectRecetteDb, migrateRecette } from '../apps/api/src/recette-migration-guard.ts';
const url=new URL(process.env.TEST_DATABASE_URL || 'invalid:');
const container=process.env.TEST_POSTGRES_CONTAINER;
if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/gobilan_test'||!container||!/^[a-zA-Z0-9_-]+$/.test(container))throw new Error('Dedicated loopback CI database/container required');
const suffix=randomUUID().replaceAll('-','');
const source=`backup_test_${suffix}`, restored=`restore_test_${suffix}`;
const admin=new pg.Client({connectionString:url.toString()});
let db,copy;
function encryptedRoundTrip(archive) {
 const workspace = mkdtempSync(join(tmpdir(), 'gobilan-backup-'));
 try {
  const key = join(workspace, 'test-key.pem');
  const certificate = join(workspace, 'test-cert.pem');
  const dump = join(workspace, 'fixture.dump');
  const encrypted = join(workspace, 'fixture.cms');
  const decrypted = join(workspace, 'decrypted.dump');
  writeFileSync(dump, archive, { mode: 0o600 });
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-noenc', '-days', '1',
   '-subj', '/CN=GoBilan CI fixture', '-keyout', key, '-out', certificate], { stdio: 'ignore' });
  const fingerprint = execFileSync('openssl', ['x509', '-in', certificate, '-noout', '-sha256', '-fingerprint'],
   { encoding: 'utf8' }).trim().split('=')[1].replaceAll(':', '');
  execFileSync('sh', ['scripts/encrypt-backup-export.sh', dump, encrypted, certificate, fingerprint], { stdio: 'ignore' });
  execFileSync('openssl', ['cms', '-decrypt', '-inform', 'DER', '-in', encrypted,
   '-recip', certificate, '-inkey', key, '-out', decrypted], { stdio: 'ignore' });
  return readFileSync(decrypted);
 } finally {
  rmSync(workspace, { recursive: true, force: true });
 }
}

function command(args,input){const result=spawnSync('docker',['exec','-i',container,...args],{input,maxBuffer:16*1024*1024});if(result.status!==0)throw new Error('Backup/restore command failed (details intentionally withheld)');return result.stdout;}
const audienceMigration = '008_audience_events.sql';
const report = line => process.stdout.write(line + '\n');

async function installPreAudienceSchema(target) {
 const files = await migrationFiles();
 assert.equal(files.at(-1), audienceMigration, 'Rehearsal must target the single migration 008');
 await target.tx(async t => {
  await t.exec('create table schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  for (const name of files.slice(0, -1)) {
   const sql = readFileSync(new URL('../apps/api/migrations/' + name, import.meta.url), 'utf8');
   await t.exec(sql);
   await t.query('insert into schema_migrations(name) values ($1)', [name]);
  }
 });
}

try {
 await admin.connect();await admin.query(`create database ${source}`);await admin.query(`create database ${restored}`);
 const sourceUrl=new URL(url);sourceUrl.pathname=`/${source}`;db=await createPgDb(sourceUrl.toString());await installPreAudienceSchema(db);
 const user=randomUUID();
 await db.query("insert into users(id,phone,country,name,created_at) values($1,'+2290100000000','BJ','Fixture sauvegarde',now())",[user]);
 await db.query("insert into businesses(owner_id,name,country,sector,created_at,opening_cash_amount) values($1,'Boutique fixture','BJ','boutique',now(),12345)",[user]);
 await db.query("insert into audit_log(at,actor,action) values(now(),'fixture@example.test','restore_fixture')");
 const archive=command(['pg_dump','-U',url.username,'-d',source,'--format=custom','--no-owner']);assert.ok(archive.length>1000);
 command(['pg_restore','-U',url.username,'--dbname',restored,'--no-owner','--exit-on-error'],encryptedRoundTrip(archive));
 const restoredUrl=new URL(url);restoredUrl.pathname=`/${restored}`;copy=await createPgDb(restoredUrl.toString());
 assert.deepEqual((await copy.query('select id,phone,country,name from users')).rows,(await db.query('select id,phone,country,name from users')).rows);
 assert.deepEqual((await copy.query('select name,opening_cash_amount from businesses')).rows,(await db.query('select name,opening_cash_amount from businesses')).rows);
 assert.deepEqual((await copy.query('select name from schema_migrations order by name')).rows,(await db.query('select name from schema_migrations order by name')).rows);
 assert.equal((await copy.query("select action from audit_log")).rows[0].action,'restore_fixture');
 await assert.rejects(copy.query("update audit_log set action='mutated'"),/ajout seul/);
 const triggers=await copy.query("select count(*)::int n from pg_trigger where not tgisinternal");assert.ok(triggers.rows[0].n>0,'Audit/append-only triggers restored');
 assert.deepEqual((await inspectRecetteDb(copy)).pending, [audienceMigration]);
 await assert.rejects(migrateRecette(copy, {}, report), /recette_database_not_empty_backup_required/);
 assert.deepEqual((await inspectRecetteDb(copy)).pending, [audienceMigration]);
 assert.equal((await copy.query("select to_regclass('audience_events') as table_name")).rows[0].table_name, null);
 assert.deepEqual(await migrateRecette(copy, { RECETTE_MIGRATION_APPROVED_UP_TO: audienceMigration }, report), [audienceMigration]);
 assert.deepEqual(await migrateRecette(copy, {}, report), []);
 assert.deepEqual((await copy.query('select id,phone,country,name from users')).rows,(await db.query('select id,phone,country,name from users')).rows);
 assert.deepEqual((await copy.query('select name,opening_cash_amount from businesses')).rows,(await db.query('select name,opening_cash_amount from businesses')).rows);
 assert.equal((await copy.query('select count(*)::int as n from audience_events')).rows[0].n, 0);
 assert.equal((await copy.query('select count(*)::int as n from audience_collection')).rows[0].n, 0);
 process.stdout.write('PASS 007 -> 008: refusal without approval, named approval, preserved fixtures, no collection and idempotent restart\n');
 process.stdout.write(String('PASS pg_dump/encryption/decryption/pg_restore into separate isolated database: user, cash, history and triggers preserved')+'\n');
}finally{
 await db?.close();await copy?.close();await admin.query(`drop database if exists ${restored}`).catch(()=>{});await admin.query(`drop database if exists ${source}`).catch(()=>{});await admin.end();
}
