// SPDX-License-Identifier: MIT
import { expect, test, vi } from 'vitest';
import { expandDice, resolvePool, resolvePercentile, generate, generatePool } from '../lib/dice';
import { resolvePowerRoll, resolveOpposedRoll, compareOpposedRolls, resolveProjectRoll, resolveSavingThrow, resolveCombatOpening } from '../lib/draw-steel';
import { describePool, describeRoll } from '../lib/format';

test('mixed groups retain identities; highest/lowest selection preserves tie order and discarded values', () => {
  const request=expandDice([{sides:6,count:3,id:'base'},{sides:10,count:1,id:'bonus'}]);
  const high=resolvePool(request,[6,6,1,8],{keep:{mode:'highest',count:2},modifier:-2});
  expect(high.dice.map(die=>[die.id,die.value,die.kept])).toEqual([
    ['base:0',6,true],['base:1',6,false],['base:2',1,false],['bonus:0',8,true],
  ]);
  expect([high.naturalTotal,high.modifier,high.total]).toEqual([14,-2,12]);
  expect(resolvePool(request,[6,6,1,8],{keep:{mode:'lowest',count:2}}).total).toBe(7);
  expect(describePool(high,'Ability').detailed).toContain('base:1: d6 = 6 (discarded)');
  expect(describePool(high,'Ability').concise).toBe('Ability: 12, kept 2 of 4 dice.');
  expect(()=>expandDice([{sides:6,count:1,id:'same'},{sides:8,count:1,id:'same'}])).toThrow('distinct');
  expect(()=>resolvePool(request,[6,6,1,11])).toThrow('valid face');
  expect(()=>resolvePool(request,[6,6,1,8],{keep:{mode:'highest',count:5}})).toThrow('keep');
});
test('percentile physical tens/units normalize zero and double zero explicitly',()=>{
  // Compendium chapter/the-basics.md, D100s: 00 is 100, not zero.
  expect(resolvePercentile(10,10)).toBe(100);
  expect(resolvePercentile(10,7)).toBe(7);
  expect(resolvePercentile(4,10)).toBe(40);
  expect(resolvePercentile(9,8)).toBe(98);
  expect(()=>resolvePercentile(0,1)).toThrow('d10');
});
test('public deterministic generator and host-supplied resolution need no browser or renderer',()=>{
  const request=expandDice([{sides:3,count:2},{sides:100,count:1}]);
  const seed=new Uint8Array(32).fill(42);
  const generated=generate(seed,0,request);
  expect(generated).toEqual(generate(seed,0,request));
  expect(generated.dice.every((die,index)=>die.id===request[index]!.id&&die.value>=1&&die.value<=die.sides)).toBe(true);
  vi.stubGlobal('crypto',undefined);
  try {
    expect(resolvePool(request,[3,2,100]).total).toBe(105);
    expect(()=>generatePool([{sides:6,count:1}])).toThrow('Secure randomness');
  }
  finally { vi.unstubAllGlobals(); }
  expect(generatePool([{sides:6,count:2}])).toHaveLength(2);
});
test('power and non-tiered presets apply distinct source-derived edge/bane arithmetic',()=>{
  // Canonical Compendium rule/dice/{edge,bane,tier-outcome,natural-roll}.md:
  // 12 is tier2, doubleedge raises a tier without changing the total; natural19 grants tier3.
  expect(resolvePowerRoll([6,6],2)).toMatchObject({natural:12,total:12,tier:3});
  expect(resolvePowerRoll([9,10],0,2,-20)).toMatchObject({total:-1,tier:3});
  // rule/dice/opposed-power-roll.md: doubleedge +4, automatictier -4; ties unchanged.
  const opposed=resolveOpposedRoll([6,6],{edges:2,characteristic:3,automaticTierAdjustment:-1});
  expect(opposed).toEqual({natural:12,modifier:3,total:15});
  expect(opposed).not.toHaveProperty('tier');
  expect(compareOpposedRolls(15,15)).toBe('unchanged');
  // rule/downtime/project-roll.md: doublebane -4, minimum1, natural19 breakthrough.
  expect(resolveProjectRoll([1,1],{banes:2})).toMatchObject({total:1,breakthrough:false});
  expect(resolveProjectRoll([9,10],{extraValues:[6],edges:2})).toMatchObject({total:29,breakthrough:true});
  expect(resolveProjectRoll([8,8],{extraValues:[6]})).toMatchObject({total:22,breakthrough:false});
  expect(()=>resolveProjectRoll([6,6],{edges:3})).toThrow('zero to two');
});
test('save and combat opening identify outcome without granting gameplay side effects',()=>{
  // rule/general/saving-throw.md and rule/combat/combat-round.md, Determine Who Goes First: six+.
  expect(resolveSavingThrow(5)).toEqual({total:5,success:false});
  expect(resolveSavingThrow(6)).toEqual({total:6,success:true});
  expect(resolveCombatOpening(5)).toEqual({total:5,chooser:'director'});
  expect(resolveCombatOpening(6)).toEqual({total:6,chooser:'players'});
  expect(()=>resolveSavingThrow(11)).toThrow('d10');
});
test('legacy power and generic formatted results disclose tier and numeric modifier correctly',()=>{
  const base={id:'roll',roller:'viewer',name:'Hypatia',faces:[6,6],startsAt:0,duration:2200,styles:[]};
  expect(describeRoll({...base,power:{edges:2,banes:0,total:12,tier:3}}).concise).toBe('Hypatia rolled 12, tier 3, double edge.');
  expect(describeRoll({...base,dice:{kind:'dice',sides:6,count:2},total:16,modifier:4,edges:2}).detailed).toContain('modifier +4; total 16');
});
