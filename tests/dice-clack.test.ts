// SPDX-License-Identifier: MIT
import { expect, it } from 'vitest';
import { diceClack } from '../web/dice-demo-v2/dice-clack';
it('keeps dice-contact strikes brief with a small second contact and bounded output',()=>{
 for (const rate of [44100,48000]) for (let variant=0;variant<4;variant++) {
  const data=diceClack(rate,variant);
  expect(data.every(Number.isFinite)).toBe(true);
  expect(Math.abs(data[0]!)).toBe(0);expect(Math.abs(data.at(-1)!)).toBe(0);
  expect(Math.max(...data.map(Math.abs))).toBeCloseTo(0.9,5);
  const total=data.reduce((sum,v)=>sum+v*v,0);let sum=0,half=0,end=0;
  for(let i=0;i<data.length;i++){
   sum+=data[i]!**2;
   if(!half&&sum>=total*.5)half=i/rate*1000;
   if(sum>=total*.9){end=i/rate*1000;break;}
  }
  // Reference contacts put half their energy into the first sub-ms strike,
  // with 90% accumulated around the second contact at 8–12 ms.
  expect(half).toBeLessThan(1);expect(end).toBeGreaterThan(7);expect(end).toBeLessThan(14);
 }
});
