// SPDX-License-Identifier: MIT
import { expect, it } from 'vitest';
import { createMembershipLog } from '../web/dice-demo-v2/membership-log';
const alex = { id: 'alex', name: 'Alex' }, sam = { id: 'sam', name: 'Sam' };
it('logs actual arrivals once, preserving names at arrival through heartbeats and edits', () => {
  const log = createMembershipLog();
  expect(log.observe('room', 0, [], 0)).toEqual([]);
  const first = log.observe('room', 0, [alex], 1);
  expect(first).toMatchObject([{ kind: 'join', participant: 'alex', name: 'Alex', startsAt: 1 }]);
  expect(log.observe('room', 0, [{ ...alex, name: 'Renamed' }], 2)).toBe(first);
  expect(log.observe('room', 0, [alex, sam], 3)).toMatchObject([
    { participant: 'sam', name: 'Sam', startsAt: 3 }, { participant: 'alex', startsAt: 1 },
  ]);
});
it('treats the first snapshot as a baseline, including after a room change or reload', () => {
  const log = createMembershipLog();
  expect(log.observe('room', 0, [alex], 0)).toEqual([]);
  expect(log.observe('room', 0, [alex, sam], 1)).toHaveLength(1);
  expect(log.observe('other', 0, [alex, sam], 2)).toEqual([]);
  expect(createMembershipLog().observe('room', 0, [alex, sam], 3)).toEqual([]);
});
it('clears notices on a mode revision while retaining the arriving player that caused the switch', () => {
  const log = createMembershipLog(); log.observe('room', 0, [], 0);
  log.observe('room', 1, [alex], 1);
  expect(log.observe('room', 2, [alex, sam], 2)).toMatchObject([{ participant: 'sam', startsAt: 2 }]);
  expect(log.observe('room', 3, [alex], 3)).toEqual([]);
});
it('records a rejoin after observed departure and bounds retained notices', () => {
  const log = createMembershipLog(); log.observe('room', 0, [], 0);
  for (let i = 0; i < 102; i++) { log.observe('room', 0, [], i); log.observe('room', 0, [sam], i); }
  const entries = log.observe('room', 0, [sam], 103);
  expect(entries).toHaveLength(100); expect(new Set(entries.map(entry => entry.id)).size).toBe(100);
});
