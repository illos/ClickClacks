// SPDX-License-Identifier: MIT
import type { ParticipantRoll } from '../web/dice-demo-v2/model';
import { criticalResult } from './critical';
export { criticalResult, criticalLabel, type CriticalResult, type CriticalRoll } from './critical';
export function rollDiceNotation(roll: Pick<ParticipantRoll, 'dice'>): string {
  return roll.dice?.kind === 'dice'
    ? `${roll.dice.count}d${roll.dice.sides}${roll.dice.bonusD4 ? ' + 1d4' : ''}`
    : '2d10';
}
export function describeRoll(roll: ParticipantRoll) {
  const total = roll.total ?? roll.power?.total ?? roll.faces.reduce((sum,face)=>sum+face,0);
  const modifier = roll.modifier ?? (roll.power ? (roll.power.edges-roll.power.banes===1 ? 2 : roll.power.edges-roll.power.banes===-1 ? -2 : 0) : 0);
  const dice = roll.dice?.kind==='dice' ? rollDiceNotation(roll) : 'power roll (2d10)';
  const meaning = roll.power ? `, tier ${roll.power.tier}` : '';
  const edge = roll.power?.edges ? `, ${roll.power.edges===2 ? 'double edge' : 'one edge'}` : '';
  const bane = roll.power?.banes ? `, ${roll.power.banes===2 ? 'double bane' : 'one bane'}` : '';
  const critical = criticalResult(roll);
  const crit = critical ? `, critical ${critical}` : '';
  return { concise:`${roll.name} rolled ${total}${meaning}${edge}${bane}${crit}.`, detailed:`${roll.name}: ${dice}; dice ${roll.faces.join(', ')}; natural total ${roll.faces.reduce((sum,face)=>sum+face,0)}${modifier ? `; modifier ${modifier>0?'+':''}${modifier}` : ''}; total ${total}${meaning}${edge}${bane}${crit}.` };
}

/** Generic host text includes every face and explicitly identifies discarded dice. */
export function describePool(result: import('./dice').PoolResult, label = 'Roll') {
  const kept = result.dice.filter(die => die.kept);
  const discarded = result.dice.filter(die => !die.kept);
  const detail = result.dice.map(die => `${die.id}: d${die.sides} = ${die.value}${die.kept ? '' : ' (discarded)'}`).join('; ');
  return {
    concise: `${label}: ${result.total}${discarded.length ? `, kept ${kept.length} of ${result.dice.length} dice` : ''}.`,
    detailed: `${label}: ${detail}; kept natural total ${result.naturalTotal}; modifier ${result.modifier >= 0 ? '+' : ''}${result.modifier}; total ${result.total}.`,
  };
}
