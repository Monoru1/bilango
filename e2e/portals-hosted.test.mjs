import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { origins, portalSessionState } from './portals-hosted.mjs';

test('requires a private active session bound to the intended HTTPS host', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gobilan-hosted-'));
  try {
    const path = join(directory, 'state.json');
    const cookie = {
      name: 'gb_admin', domain: new URL(origins.admin).hostname, path: '/', httpOnly: true,
      secure: true, value: 'fixture-only', expires: -1,
    };
    const save = cookies => writeFileSync(path, JSON.stringify({ cookies, origins: [{ origin: origins.pwa }] }), { mode: 0o600 });
    save([cookie, { ...cookie, name: 'unrelated-cookie' }]);
    assert.deepEqual(portalSessionState(path, 'admin'), { cookies: [cookie], origins: [] });
    assert.throws(() => portalSessionState(path, 'partner'), /Session de recette/);
    chmodSync(path, 0o644);
    assert.throws(() => portalSessionState(path, 'admin'), /privé/);
    chmodSync(path, 0o600);
    for (const change of [{ expires: 1 }, { domain: '.netlify.app' }, { secure: false }]) {
      save([{ ...cookie, ...change }]);
      assert.throws(() => portalSessionState(path, 'admin'), /Session de recette/);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
