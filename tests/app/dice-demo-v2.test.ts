// SPDX-License-Identifier: MIT
import { expect, test } from 'vitest';
import { backend } from './fixtures/table';
import { demoV2 } from '../../web/dice-demo-v2/api';
const key = '12345678-1234-1234-1234-123456789010';
const a = '12345678-1234-1234-1234-123456789011';
const b = '12345678-1234-1234-1234-123456789012';
const style = { color: '#a63a3a', ink: '#fff0dc', pattern: 'marble' as const };
// Two recorded positions with identity rotations suffice to exercise storage, not physics.
const frame = [0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1];
const motion = {
  seed: 42,
  stepMs: 1000 / 60,
  samples: [...frame, ...frame],
  offsets: [0, 0, 0, 1, 0, 0, 0, 1],
};
test('independent participants throw concurrently and retain separate attributed results', async () => {
  const t = backend();
  await t.mutation(demoV2.join, {
    key,
    viewer: a,
    name: 'Amber Otter',
    style,
    ready: true,
    uncertainty: 10,
  });
  await t.mutation(demoV2.join, {
    key,
    viewer: b,
    name: 'Silver Fox',
    style: { ...style, color: '#3344aa' },
    ready: true,
    uncertainty: 10,
  });
  const first = {
    key,
    viewer: a,
    id: '12345678-1234-1234-1234-123456789013',
    faces: [1, 10],
    motion,
  };
  const second = { ...first, viewer: b, id: '12345678-1234-1234-1234-123456789014', faces: [3, 4] };
  await Promise.all([t.mutation(demoV2.throwDice, first), t.mutation(demoV2.throwDice, second)]);
  const one = await t.query(demoV2.track, { key, viewer: a });
  const two = await t.query(demoV2.track, { key, viewer: b });
  expect(one?.roll.faces).toEqual([1, 10]);
  expect(one?.roll.name).toBe('Amber Otter');
  expect(two?.roll.faces).toEqual([3, 4]);
  expect(two?.roll.name).toBe('Silver Fox');
  expect(one?.roll.styles).toEqual([style, style]);
  expect(two?.roll.styles[0]).toEqual(two?.roll.styles[1]);
  expect(await t.mutation(demoV2.throwDice, first)).toEqual(one?.roll);
  await expect(t.mutation(demoV2.throwDice, { ...first, faces: [2, 10] })).rejects.toThrow(
    'already used',
  );
  await expect(
    t.mutation(demoV2.throwDice, { ...first, id: '12345678-1234-1234-1234-123456789015' }),
  ).rejects.toThrow('still rolling');
  await t.mutation(demoV2.receipt, {
    key,
    roller: a,
    sample: {
      viewer: b,
      roll: first.id,
      firstFrame: one!.roll.startsAt,
      revealFrame: one!.roll.startsAt + one!.roll.duration,
      uncertainty: 10,
      frames: 2,
      maxFrameGap: 17,
    },
  });
  expect((await t.query(demoV2.track, { key, viewer: a }))?.receipts).toHaveLength(1);
  expect((await t.query(demoV2.track, { key, viewer: b }))?.receipts).toHaveLength(0);
});
test('heartbeats retain customization and slots; room capacity and input bounds are enforced', async () => {
  const t = backend();
  const join = { key, viewer: a, name: 'Amber Otter', style, ready: true, uncertainty: 10 };
  await t.mutation(demoV2.join, join);
  await t.mutation(demoV2.customize, {
    key,
    viewer: a,
    name: 'My dice',
    style: { ...style, color: '#aabbcc' },
  });
  await t.mutation(demoV2.join, join);
  const state = await t.query(demoV2.view, { key });
  expect(state.participants[0]).toMatchObject({
    name: 'My dice',
    style: { ...style, color: '#aabbcc' },
    slot: 0,
  });
  for (let i = 1; i < 8; i++)
    await t.mutation(demoV2.join, {
      ...join,
      viewer: `12345678-1234-1234-1234-1234567890${20 + i}`,
    });
  await expect(t.mutation(demoV2.join, { ...join, viewer: b })).rejects.toThrow('eight');
  await expect(
    t.mutation(demoV2.customize, { key, viewer: b, name: 'Absent', style }),
  ).rejects.toThrow('Reconnect');
  expect(
    await t.query(demoV2.track, { key: '12345678-1234-1234-1234-123456789099', viewer: a }),
  ).toBeNull();
  await expect(
    t.mutation(demoV2.throwDice, {
      key,
      viewer: a,
      id: b,
      faces: [1, 10],
      motion: { ...motion, stepMs: NaN },
    }),
  ).rejects.toThrow('Invalid recorded motion');
});
