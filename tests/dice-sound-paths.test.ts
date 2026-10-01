// SPDX-License-Identifier: MIT
import { expect, it } from 'vitest';
import { simulateThrow } from '../web/dice-demo/physics';
import { diceImpacts } from '../web/dice-demo-v2/dice-sound';
import type { DiceSides } from '../web/dice-demo/model';
it('finds audible landing strikes for each supported die and a dense bonus pool', () => {
  for (const sides of [4,6,8,10,12,20] as DiceSides[]) {
    for (const seed of [1,17,91]) {
      const path=simulateThrow(seed,[sides],{scale:0.65,dice:{kind:'dice',sides,count:1}});
      expect(diceImpacts(path,1).length,`d${sides} seed ${seed}`).toBeGreaterThan(0);
    }
  }
  const path=simulateThrow(1,[...Array(20).fill(20),4],{scale:0.65,dice:{kind:'dice',sides:20,count:20,bonusD4:true}});
  expect(diceImpacts(path,21).length).toBeGreaterThan(0);
});
