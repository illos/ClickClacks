// SPDX-License-Identifier: MIT
import { expect, test } from 'vitest';
import { dicePoolSides, naturalDiceTotal, resolvePercentile, validateDiceConfiguration, type DiceConfiguration } from '../shared/dice';
import { resolvePercentile as publicResolvePercentile } from '../lib/dice';
import { diceFromFlags } from '../scripts/cli';
const percentile: DiceConfiguration = {kind:'percentile',sides:10,count:2};

test('percentile tens/units map the requested examples and every pair to exactly one value from 1 through 100', () => {
  for (const [tens,units,result] of [[4,7,47],[10,6,6],[9,9,99],[10,1,1],[10,10,100]]) {
    expect(resolvePercentile(tens!,units!)).toBe(result);
    expect(naturalDiceTotal([tens!,units!],percentile)).toBe(result);
    expect(publicResolvePercentile(tens!,units!)).toBe(result);
  }
  const values = Array.from({length:10},(_,tens)=>Array.from({length:10},(_,units)=>resolvePercentile(tens+1,units+1))).flat();
  expect(values.sort((a,b)=>a-b)).toEqual(Array.from({length:100},(_,i)=>i+1));
});

test('percentile configurations enforce exactly the d10 pair while allowing one bounded bonus d4', () => {
  expect(dicePoolSides(percentile)).toEqual([10,10]);
  expect(dicePoolSides({...percentile,bonusD4:true})).toEqual([10,10,4]);
  expect(naturalDiceTotal([10,10,4],{...percentile,bonusD4:true})).toBe(104);
  for (const dice of [{...percentile,count:1},{...percentile,count:3},{...percentile,sides:20}])
    expect(()=>validateDiceConfiguration(dice as DiceConfiguration)).toThrow();
  for (const faces of [[0,1],[1,0],[11,1],[1.5,2],[1],[1,2,3]])
    expect(()=>naturalDiceTotal(faces,percentile)).toThrow();
  expect(()=>naturalDiceTotal([4,7,5],{...percentile,bonusD4:true})).toThrow();
  expect(naturalDiceTotal([4,7])).toBe(11);
  expect(naturalDiceTotal([4,7],{kind:'dice',sides:10,count:2})).toBe(11);
});

test('CLI percentile and 100 aliases preserve the fixed pair and optional d4; incompatible count fails', () => {
  expect(diceFromFlags({dice:'percentile'})).toEqual(percentile);
  expect(diceFromFlags({dice:'100',count:'2','bonus-d4':'true'})).toEqual({...percentile,bonusD4:true});
  for (const count of ['1','3','20','no'])
    expect(()=>diceFromFlags({dice:'100',count})).toThrow('exactly two');
  expect(()=>diceFromFlags({dice:'percentile','bonus-d4':'yes'})).toThrow('true or false');
});
