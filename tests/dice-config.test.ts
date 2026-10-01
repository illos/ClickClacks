// SPDX-License-Identifier: MIT
import { expect, test } from 'vitest';
import {dicePoolSides,dicePoolCount,dieSides,validateDiceConfiguration} from '../shared/dice';
test('bonus d4 occupies the final slot of eligible generic pools without changing base count',()=>{
  for(const sides of [6,8,10,12,20] as const){
    const dice={kind:'dice' as const,sides,count:20,bonusD4:true};
    expect(dicePoolCount(dice)).toBe(21);
    expect(dicePoolSides(dice)).toEqual([...Array(20).fill(sides),4]);
    expect(dieSides(dice,0)).toBe(sides);
    expect(dieSides(dice,20)).toBe(4);
    expect(()=>dieSides(dice,21)).toThrow('index');
  }
  expect(dicePoolSides({kind:'power',sides:10,count:2})).toEqual([10,10]);
  expect(dicePoolCount({kind:'dice',sides:4,count:20,bonusD4:false})).toBe(20);
  expect(()=>validateDiceConfiguration({kind:'dice',sides:4,count:1,bonusD4:true})).toThrow();
  expect(()=>validateDiceConfiguration({kind:'power',sides:10,count:2,bonusD4:true})).toThrow();
});
