import { expect, it, vi } from 'vitest';
import { createController, type ParticipantRoll, type Transport } from '../lib/client';
const profile = { name: 'Fixture', style: { color: '#ffffff', ink: '#000000', pattern: 'solid' as const } };
const identity = { viewer: 'viewer', credential: 'private' };
const recording = { seed: 1, stepMs: 1000 / 60, samples: [], offsets: [], packed: new Float64Array([1, 2, 3, 0, 0, 0, 1]).buffer };
function fixture() {
  const callbacks = new Map<string, (value: any) => void>();
  let accept!: (roll: ParticipantRoll) => void;
  const accepted = new Promise<ParticipantRoll>(resolve => { accept = resolve; });
  const call = vi.fn(async (method: string) => {
    if (method === 'diceDemoV2:view') return { participants: [{ id: 'viewer' }], code: 'ABCDEFGH', expired: false, cursor: 0 };
    if (method === 'diceDemoV2:events') return { rolls: [], cursor: 0, hasMore: false };
    if (method === 'diceDemo:sampleFaces') return [3];
    if (method === 'diceDemoV2:throwDice') return accepted;
    if (method === 'diceDemoV2:motion') return new Promise(() => {});
    return null;
  });
  const transport: Transport = { compactTracks: true, call,
    watch: (method, _args, next) => { callbacks.set(method, next); return () => {}; },
  };
  const controller = createController({ key: 'room', transport, identity, profile, clockEstimate: () => ({ offset: 0, uncertainty: 1 }) });
  const roll: ParticipantRoll = { id: 'roll', roller: 'viewer', name: profile.name, faces: [3], styles: [profile.style],
    startsAt: Date.now() + 1000, duration: 2000, historyExpiresAt: Date.now() + 3600000 };
  return { controller, call, callbacks, accept, roll };
}
async function flush() { for (let i = 0; i < 16; i++) await Promise.resolve(); }
it('uses the authoritative acceptance recording without downloading the roller\'s own motion', async () => {
  const f = fixture(), track = vi.fn();
  f.controller.on('track', track);
  await f.controller.observe();
  const pending = f.controller.roll({ id: 'roll', dice: { kind: 'dice', sides: 20, count: 1 } });
  await flush();
  f.accept({ ...f.roll, motion: recording });
  const accepted = await pending;
  f.callbacks.get('diceDemoV2:trackMetadata')!({ roll: f.roll, receipts: [] });
  await flush();
  expect(track.mock.calls[0][0].roll.motion.samples).toEqual([1, 2, 3, 0, 0, 0, 1]);
  expect(track.mock.calls[0][0].roll.motion).toBe(accepted.motion);
  expect(f.call.mock.calls.some(([method]) => method === 'diceDemoV2:motion')).toBe(false);
  await f.controller.dispose();
});
it('unblocks earlier subscribed hydration when acceptance returns before a stalled recording download', async () => {
  const f = fixture(), track = vi.fn();
  f.controller.on('track', track);
  await f.controller.observe();
  const pending = f.controller.roll({ id: 'roll', dice: { kind: 'dice', sides: 20, count: 1 } });
  await flush();
  f.callbacks.get('diceDemoV2:trackMetadata')!({ roll: f.roll, receipts: [] });
  await flush();
  expect(track).not.toHaveBeenCalled();
  f.accept({ ...f.roll, motion: recording });
  await pending; await flush();
  expect(track.mock.calls[0][0].roll.motion.samples).toHaveLength(7);
  await f.controller.dispose();
});
for (const event of ['clear', 'departure'] as const) it(`does not restore dice after ${event} precedes a delayed acceptance reply`, async () => {
  const f = fixture(), track = vi.fn();
  f.controller.on('track', track);
  await f.controller.observe();
  const pending = f.controller.roll({ id: 'roll', dice: { kind: 'dice', sides: 20, count: 1 } });
  await flush();
  f.callbacks.get('diceDemoV2:trackMetadata')!({ roll: f.roll, receipts: [] });
  if (event === 'clear') f.callbacks.get('diceDemoV2:trackMetadata')!(null);
  else f.callbacks.get('diceDemoV2:view')!({ participants: [], code: 'ABCDEFGH', expired: false, cursor: 0 });
  f.accept({ ...f.roll, motion: recording });
  await pending; await flush();
  expect(track).not.toHaveBeenCalled();
  await f.controller.dispose();
});
