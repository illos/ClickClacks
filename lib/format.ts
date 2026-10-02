// SPDX-License-Identifier: MIT
import type { ParticipantRoll } from '../shared/room';
import { criticalResult } from './critical';
import { naturalDiceTotal } from '../shared/dice';
export { criticalResult, criticalLabel, type CriticalResult, type CriticalRoll } from './critical';
type RollFaces = Pick<ParticipantRoll, 'faces' | 'dice'>;
/** One percentile pair is one d100; the optional bonus remains a separate d4. */
export function rollDiceNotation(roll: Pick<ParticipantRoll, 'dice'>): string {
  const dice = roll.dice;
  if (dice?.kind === 'percentile') return `1d100${dice.bonusD4 ? ' + 1d4' : ''}`;
  return dice?.kind === 'dice'
    ? `${dice.count}d${dice.sides}${dice.bonusD4 ? ' + 1d4' : ''}`
    : '2d10';
}
export function rollNaturalTotal(roll: RollFaces): number {
  return roll.dice?.kind === 'percentile'
    ? naturalDiceTotal(roll.faces, roll.dice)
    : roll.faces.reduce((sum, face) => sum + face, 0);
}
/** Physical d10 face ten prints zero; the first percentile die prints tens. */
export function rollFaceLabels(roll: RollFaces): string[] {
  if (roll.dice?.kind !== 'percentile') return roll.faces.map(String);
  return [String((roll.faces[0]! % 10) * 10).padStart(2, '0'), String(roll.faces[1]! % 10), ...roll.faces.slice(2).map(String)];
}
export function rollFacesText(roll: RollFaces): string {
  const labels = rollFaceLabels(roll);
  // Make double zero's special hundred explicit before adding a bonus/modifier.
  if (roll.dice?.kind === 'percentile' && labels[0] === '00' && labels[1] === '0')
    return ['100 (00 + 0)', ...labels.slice(2)].join(' + ');
  return labels.join(' + ');
}
export function describeRoll(roll: ParticipantRoll) {
  const natural = rollNaturalTotal(roll);
  const total = roll.total ?? roll.power?.total ?? natural;
  const modifier = roll.modifier ?? (roll.power ? (roll.power.edges-roll.power.banes===1 ? 2 : roll.power.edges-roll.power.banes===-1 ? -2 : 0) : 0);
  const dice = roll.dice && roll.dice.kind !== 'power' ? rollDiceNotation(roll) : 'power roll (2d10)';
  const meaning = roll.power ? `, tier ${roll.power.tier}` : '';
  const edge = roll.power?.edges ? `, ${roll.power.edges===2 ? 'double edge' : 'one edge'}` : '';
  const bane = roll.power?.banes ? `, ${roll.power.banes===2 ? 'double bane' : 'one bane'}` : '';
  const critical = criticalResult(roll);
  const crit = critical ? `, critical ${critical}` : '';
  return { concise:`${roll.name} rolled ${total}${meaning}${edge}${bane}${crit}.`, detailed:`${roll.name}: ${dice}; dice ${rollFaceLabels(roll).join(', ')}; natural total ${natural}${modifier ? `; modifier ${modifier>0?'+':''}${modifier}` : ''}; total ${total}${meaning}${edge}${bane}${crit}.` };
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
