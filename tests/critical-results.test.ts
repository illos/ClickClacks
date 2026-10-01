// SPDX-License-Identifier: MIT
import { expect, it } from 'vitest';
import { criticalResult, criticalLabel, describeRoll } from '../lib/format';

it('uses natural Power 19/20 and double ones regardless of modifiers', () => {
  // Compendium rule/dice/natural-19-20.md, “Success With a Reward”: before modifiers.
  // Double-one failure is the owner's standalone display requirement.
  for (const faces of [[9,10],[10,9],[10,10]]) expect(criticalResult({faces})).toBe('success');
  expect(criticalResult({faces:[1,1]})).toBe('failure');
  for (const faces of [[9,9],[1,2],[1,10],[10,8]]) expect(criticalResult({faces})).toBeNull();
  const roll = {id:'power',roller:'me',name:'Hypatia',faces:[9,10],styles:[],startsAt:0,duration:2200,power:{total:17,edges:0,banes:1,tier:3 as const}};
  expect(describeRoll(roll).concise).toContain('17, tier 3, one bane, critical success');
  expect(describeRoll({...roll,faces:[9,9],power:{...roll.power,total:20}}).concise).not.toContain('critical');
});

it('labels only single d20 natural endpoints and ignores a bonus d4', () => {
  const dice = {kind:'dice' as const,sides:20 as const,count:1};
  expect(criticalResult({dice,faces:[20]})).toBe('success');
  expect(criticalResult({dice,faces:[1]})).toBe('failure');
  expect(criticalResult({dice:{...dice,bonusD4:true},faces:[20,1]})).toBe('success');
  expect(criticalResult({dice:{...dice,bonusD4:true},faces:[1,4]})).toBe('failure');
  expect(criticalResult({dice:{...dice,bonusD4:true},faces:[19,1]})).toBeNull();
  for (const sides of [4,6,8,10,12] as const) expect(criticalResult({dice:{...dice,sides},faces:[1]})).toBeNull();
  for (const faces of [[20,1],[20,20],[1,1],[8,12]]) expect(criticalResult({dice:{...dice,count:2},faces})).toBeNull();
  expect(criticalLabel('success')).toBe('Crit');expect(criticalLabel('failure')).toBe('Crit fail');
});
