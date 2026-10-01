// SPDX-License-Identifier: MIT
import { expect, it } from 'vitest';
import { woodClack } from '../web/dice-demo-v2/wood-clack';
it('keeps wood impacts finite, bounded and full enough to avoid a sub-2ms tick',()=>{
 for (const rate of [44100,48000]) for (let variant=0;variant<4;variant++) {
  const data=woodClack(rate,variant);
  expect(data.every(Number.isFinite)).toBe(true);expect(Math.abs(data[0]!)).toBe(0);expect(Math.abs(data.at(-1)!)).toBe(0);
  expect(Math.max(...data.map(Math.abs))).toBeCloseTo(0.9,5);
  const total=data.reduce((sum,v)=>sum+v*v,0);let sum=0,end=0;
  for(let i=0;i<data.length;i++){sum+=data[i]!**2;if(sum>=total*.9){end=i/rate*1000;break;}}
  // Medium wood reference is ~9ms; broader heavy wood is ~16ms after the attack.
  expect(end).toBeGreaterThan(7);expect(end).toBeLessThan(18);
 }
});
