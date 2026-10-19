import { randomBytes } from 'node:crypto';
import { FakeClock } from '../src/clock';
import { createPgliteDb, migrate, type Db } from '../src/db';
import { defaultConfig, type Deps } from '../src/deps';
import { createDevProviders } from '../src/providers';

export const T0 = Date.parse('2026-10-19T10:00:00.000Z');

export async function makeDeps(over: Partial<Deps> = {}) {
  const db: Db = await createPgliteDb();
  await migrate(db);
  const clock = new FakeClock(T0);
  const providers = createDevProviders();
  const deps: Deps = {
    db,
    clock,
    providers,
    secrets: { pepper: randomBytes(32), payoutKey: randomBytes(32), fedapayWebhookSecret: 'whsec_test' },
    config: { ...defaultConfig },
    ...over,
  };
  return { deps, db, clock, providers };
}

export const device = (id = 'device-aaaaaaaa') => ({ deviceId: id, label: 'Test' });
