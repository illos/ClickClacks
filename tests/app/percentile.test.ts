// SPDX-License-Identifier: MIT
import { afterEach, expect, test, vi } from 'vitest';
import { backend, componentBackend } from './fixtures/table';
import { demoV2 } from '../../web/dice-demo-v2/api';
import { demo } from '../../web/dice-demo/api';
import { api as componentApi } from '../../component/_generated/api';
import type { DiceConfiguration } from '../../shared/dice';
const session = {key:'12345678-1234-1234-1234-123456789010',viewer:'12345678-1234-1234-1234-123456789011',credential:'private-session-credential-for-percentile-123456'};
const member = {...session,name:'Sappho',style:{color:'#a63a3a',ink:'#fff0dc',pattern:'solid' as const},ready:true,uncertainty:10};
const percentile: DiceConfiguration = {kind:'percentile',sides:10,count:2};
const id = (n:number) => `12345678-1234-1234-1234-${String(n).padStart(12,'0')}`;
afterEach(()=>vi.useRealTimers());

test('percentile examples persist interpreted totals with raw faces, no power outcome and stable archive readback', async()=>{
  vi.useFakeTimers();
  const t = componentBackend();
  await t.mutation(componentApi.diceDemoV2.join,member);
  const examples = [[4,7,47],[10,6,6],[9,9,99],[10,1,1],[10,10,100]] as const;
  for (const [index,[tens,units,expected]] of examples.entries()) {
    const args = {...session,id:id(100+index),dice:percentile,faces:[tens,units]};
    const roll = await t.mutation(componentApi.diceDemoV2.acceptSupplied,args);
    const persisted = await t.query(componentApi.diceDemoV2.track,{key:session.key,viewer:session.viewer});
    expect(persisted!.roll).toEqual(roll);
    expect([persisted!.roll.faces,persisted!.roll.total,persisted!.roll.modifier,persisted!.roll.power]).toEqual([[tens,units],expected,0,undefined]);
    const receipt = await t.run(ctx=>ctx.db.query('diceDemoV2Requests').withIndex('by_request',q=>q.eq('key',session.key).eq('viewer',session.viewer).eq('id',args.id)).unique());
    expect([receipt!.faces,receipt!.dice,receipt!.roll!.total]).toEqual([[tens,units],percentile,expected]);
    expect(await t.mutation(componentApi.diceDemoV2.acceptSupplied,args)).toEqual(roll);
    vi.advanceTimersByTime(3000);
  }
  const archive = await t.query(componentApi.diceDemoV2.events,{...session,after:0});
  expect(archive.rolls.map(roll=>roll.total)).toEqual([47,6,99,1,100]);
});

test('percentile d4 and staged bonuses/penalties apply after percentile resolution and are immutable on retry', async()=>{
  vi.useFakeTimers();
  const t = componentBackend();
  await t.mutation(componentApi.diceDemoV2.join,member);
  const dice: DiceConfiguration = {...percentile,bonusD4:true};
  for (const [index,[edges,banes,expected]] of [[0,0,104],[1,0,106],[2,0,109],[0,1,102],[0,2,99],[2,1,107]].entries()) {
    const args = {...session,id:id(200+index),dice,faces:[10,10,4],edges,banes};
    const roll = await t.mutation(componentApi.diceDemoV2.acceptSupplied,args);
    expect([roll.total,roll.modifier,roll.power,roll.styles.length]).toEqual([expected,expected!-104,undefined,3]);
    expect((await t.query(componentApi.diceDemoV2.track,{key:session.key,viewer:session.viewer}))!.roll).toEqual(roll);
    await t.mutation(componentApi.diceDemoV2.clearTray,session);
    expect(await t.mutation(componentApi.diceDemoV2.acceptSupplied,args)).toEqual(roll);
    await expect(t.mutation(componentApi.diceDemoV2.acceptSupplied,{...args,edges:(edges!+1)%3})).rejects.toThrow('already used');
    vi.advanceTimersByTime(3000);
  }
  const archive = await t.query(componentApi.diceDemoV2.events,{...session,after:0});
  expect(archive.rolls.map(roll=>roll.total)).toEqual([104,106,109,102,99,107]);
  await expect(t.mutation(componentApi.diceDemoV2.acceptSupplied,{...session,id:id(299),dice,faces:[4,7,5]})).rejects.toThrow('valid dice results');
});

test('generated percentile sampling binds the tens/units/d4 raw faces and rejects cross-kind reuse or invalid pairs', async()=>{
  const t = backend();
  await t.mutation(demoV2.join,member);
  const dice: DiceConfiguration = {...percentile,bonusD4:true};
  const args = {...session,id:id(300),dice};
  const faces = await t.action(demo.sampleFaces,args);
  expect(faces).toHaveLength(3);
  expect(faces.slice(0,2).every(face=>Number.isInteger(face)&&face>=1&&face<=10)).toBe(true);
  expect(faces[2]).toBeGreaterThanOrEqual(1);
  expect(faces[2]).toBeLessThanOrEqual(4);
  expect(await t.action(demo.sampleFaces,args)).toEqual(faces);
  for (const changed of [{kind:'dice',sides:10,count:2,bonusD4:true},{kind:'power',sides:10,count:2},{...percentile} ] as DiceConfiguration[])
    await expect(t.action(demo.sampleFaces,{...args,dice:changed})).rejects.toThrow('already used');
  for (const changed of [{...percentile,count:1},{...percentile,count:3},{...percentile,sides:20}] as DiceConfiguration[])
    await expect(t.action(demo.sampleFaces,{...args,id:id(301),dice:changed})).rejects.toThrow('Choose a power roll');
  const roll = await t.mutation(demoV2.throwDice,{...args,faces,edges:2,banes:1});
  const base = (faces[0]!%10)*10 + faces[1]!%10;
  expect([roll.total,roll.modifier,roll.power]).toEqual([(base||100)+faces[2]!+3,3,undefined]);
  expect((await t.query(demoV2.track,{key:session.key,viewer:session.viewer}))!.roll).toEqual(roll);
  await t.mutation(demoV2.clearTray,session);
  expect(await t.mutation(demoV2.throwDice,{...args,faces,edges:2,banes:1})).toEqual(roll);
  expect((await t.query(demoV2.events,{...session,after:0})).rolls).toEqual([roll]);
  await expect(t.mutation(demoV2.throwDice,{...args,dice:{kind:'dice',sides:10,count:2,bonusD4:true},faces,edges:2,banes:1})).rejects.toThrow('already used');
});
