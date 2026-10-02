// SPDX-License-Identifier: MIT
import { expect, it } from 'vitest';
import { describeRoll, rollDiceNotation, rollFaceLabels, rollFacesText, rollNaturalTotal, criticalResult } from '../lib/format';
import type { ParticipantRoll } from '../web/dice-demo-v2/model';
const base: ParticipantRoll = {id:'percentile',roller:'me',name:'Sappho',faces:[4,7],dice:{kind:'percentile',sides:10,count:2},styles:[],startsAt:0,duration:2200};
it('history and announcements describe the decimal places and correct unmodified percentile result',()=>{
  for(const [faces,labels,total,expression] of [
    [[4,7],['40','7'],47,'40 + 7'],
    [[10,6],['00','6'],6,'00 + 6'],
    [[9,9],['90','9'],99,'90 + 9'],
    [[10,1],['00','1'],1,'00 + 1'],
    [[10,10],['00','0'],100,'100 (00 + 0)'],
  ] as const){
    const roll={...base,faces:[...faces]};
    expect(rollDiceNotation(roll)).toBe('1d100');
    expect(rollFaceLabels(roll)).toEqual(labels);
    expect(rollFacesText(roll)).toBe(expression);
    expect(rollNaturalTotal(roll)).toBe(total);
    expect(describeRoll(roll).concise).toBe(`Sappho rolled ${total}.`);
    expect(describeRoll(roll).detailed).toContain(`dice ${labels.join(', ')}; natural total ${total}; total ${total}`);
    expect(criticalResult(roll)).toBeNull();
  }
});
it('the optional d4 and modifier follow the percentile value without implying a power tier',()=>{
  const roll={...base,dice:{...base.dice!,bonusD4:true},faces:[10,10,4],modifier:5,total:109};
  expect(rollDiceNotation(roll)).toBe('1d100 + 1d4');
  expect(rollFacesText(roll)).toBe('100 (00 + 0) + 4');
  expect(rollNaturalTotal(roll)).toBe(104);
  expect(describeRoll(roll).detailed).toBe('Sappho: 1d100 + 1d4; dice 00, 0, 4; natural total 104; modifier +5; total 109.');
});
