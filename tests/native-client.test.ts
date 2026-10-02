// SPDX-License-Identifier: MIT
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('imports the public client and rolls locally with native Node TypeScript support', () => {
  const entry = new URL('../lib/client.ts', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { strict as assert } from 'node:assert';
    import { createAutomaticSession, createController, RollerError } from ${JSON.stringify(entry)};
    const identity = { viewer: 'native', credential: 'private' };
    const profile = { name: 'Native', style: { color: '#abcdef', ink: '#000000', pattern: 'solid', font: 'serif' } };
    const session = createAutomaticSession(identity);
    const stop = session.subscribe(() => {});
    const now = Date.now();
    session.observe({ code: 'ABCDEFGH', expired: false, cursor: 0, participants: [{ id: identity.viewer, ...profile, seenAt: now, ready: true, uncertainty: 0, slot: 0 }] }, now, true);
    assert.equal(session.getSnapshot().mode, 'local');
    const controller = createController({ identity, profile, key: 'room', transport: session.localTransport(profile), clockEstimate: () => ({ offset: 0, uncertainty: 0 }) });
    try {
      await controller.observe();
      const roll = await controller.roll({ id: 'native-roll', dice: { kind: 'dice', sides: 6, count: 2 } });
      assert.equal(roll.local, true);
      assert.equal(roll.name, profile.name);
      assert.equal(roll.faces.length, 2);
      assert(roll.faces.every(face => Number.isInteger(face) && face >= 1 && face <= 6));
      assert.equal(roll.total, roll.faces[0] + roll.faces[1]);
      assert.deepEqual(new RollerError('INVALID', 'example').toJSON(), { code: 'INVALID', message: 'example' });
    } finally { await controller.dispose(); stop(); }
  `], { encoding: 'utf8', timeout: 10000 });
  expect(result.stderr).toBe('');
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
});
