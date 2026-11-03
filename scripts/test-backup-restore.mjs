/** CI only: restore a synthetic database into a SECOND disposable database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { createPgDb, migrate } from '../apps/api/src/db.ts';
const url=new URL(process.env.TEST_DATABASE_URL || 'invalid:');
const container=process.env.TEST_POSTGRES_CONTAINER;
if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/gobilan_test'||!container||!/^[a-zA-Z0-9_-]+$/.test(container))throw new Error('Dedicated loopback CI database/container required');
const suffix=randomUUID().replaceAll('-','');
const source=`backup_test_${suffix}`, restored=`restore_test_${suffix}`;
const admin=new pg.Client({connectionString:url.toString()});
let db,copy;
function command(args,input){const result=spawnSync('docker',['exec','-i',container,...args],{input,maxBuffer:16*1024*1024});if(result.status!==0)throw new Error('Backup/restore command failed (details intentionally withheld)');return result.stdout;}
try {
 await admin.connect();await admin.query(`create database ${source}`);await admin.query(`create database ${restored}`);
 const sourceUrl=new URL(url);sourceUrl.pathname=`/${source}`;db=await createPgDb(sourceUrl.toString());await migrate(db);
 const user=randomUUID();
 await db.query("insert into users(id,phone,country,name,created_at) values($1,'+2290100000000','BJ','Fixture sauvegarde',now())",[user]);
 await db.query("insert into businesses(owner_id,name,country,sector,created_at,opening_cash_amount) values($1,'Boutique fixture','BJ','boutique',now(),12345)",[user]);
 await db.query("insert into audit_log(at,actor,action) values(now(),'fixture@example.test','restore_fixture')");
 const archive=command(['pg_dump','-U',url.username,'-d',source,'--format=custom','--no-owner']);assert.ok(archive.length>1000);
 command(['pg_restore','-U',url.username,'--dbname',restored,'--no-owner','--exit-on-error'],archive);
 const restoredUrl=new URL(url);restoredUrl.pathname=`/${restored}`;copy=await createPgDb(restoredUrl.toString());
 assert.deepEqual((await copy.query('select id,phone,country,name from users')).rows,(await db.query('select id,phone,country,name from users')).rows);
 assert.deepEqual((await copy.query('select name,opening_cash_amount from businesses')).rows,(await db.query('select name,opening_cash_amount from businesses')).rows);
 assert.deepEqual((await copy.query('select name from schema_migrations order by name')).rows,(await db.query('select name from schema_migrations order by name')).rows);
 assert.equal((await copy.query("select action from audit_log")).rows[0].action,'restore_fixture');
 await assert.rejects(copy.query("update audit_log set action='mutated'"),/ajout seul/);
 const triggers=await copy.query("select count(*)::int n from pg_trigger where not tgisinternal");assert.ok(triggers.rows[0].n>0,'Audit/append-only triggers restored');
 assert.deepEqual(await migrate(copy),[],'Restored migration history is reusable');
 process.stdout.write(String('PASS pg_dump/pg_restore into separate isolated database: user, cash, history and triggers preserved')+'\n');
}finally{
 await db?.close();await copy?.close();await admin.query(`drop database if exists ${restored}`).catch(()=>{});await admin.query(`drop database if exists ${source}`).catch(()=>{});await admin.end();
}
