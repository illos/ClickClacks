// SPDX-License-Identifier: MIT
import { makeFunctionReference } from 'convex/server';
import type { Motion, Receipt, Roll, Room, LegacyStyle as Style } from './model';
export const demo = {
  sampleFaces: makeFunctionReference<'action', Record<string, never>, number[]>(
    'diceDemo:sampleFaces',
  ),
  clock: makeFunctionReference<'action', Record<string, never>, number>('diceDemo:clock'),
  view: makeFunctionReference<'query', { key: string }, Room | null>('diceDemo:view'),
  join: makeFunctionReference<
    'mutation',
    { key: string; viewer: string; name: string; ready: boolean; uncertainty: number },
    null
  >('diceDemo:join'),
  throwDice: makeFunctionReference<
    'mutation',
    { key: string; viewer: string; id: string; faces: number[]; styles: Style[]; motion?: Motion },
    Roll
  >('diceDemo:throwDice'),
  receipt: makeFunctionReference<'mutation', { key: string; sample: Receipt }, null>(
    'diceDemo:receipt',
  ),
};
