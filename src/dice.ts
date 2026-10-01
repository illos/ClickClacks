import { resolveDrawSteel } from './draw-steel.js';

export interface DiceGroup { sides: number; count: number; id?: string }
export type Ruleset = 'sum' | 'draw-steel/power' | 'draw-steel/opposed' | 'draw-steel/project' | 'draw-steel/save' | 'draw-steel/initiative' | 'percentile';
export interface RollRequest {
  requestId: string;
  dice: DiceGroup[];
  ruleset: Ruleset;
  modifiers?: { characteristic?: number; edges?: number; banes?: number; bonus?: number };
  keep?: { mode: 'highest' | 'lowest'; count: number };
  context?: { label?: string; actorId?: string; [key: string]: unknown };
}
export interface DieResult { id: string; sides: number; value: number; kept: boolean }
export interface ResolvedResult {
  dice: DieResult[]; naturalTotal: number; total: number;
  tier?: 1 | 2 | 3; success?: boolean; critical?: boolean; breakthrough?: boolean;
  summary: string;
}
export const MAX_DICE = 100;
export const MAX_SIDES = 1000;
const rulesets = new Set<Ruleset>(['sum', 'percentile', 'draw-steel/power', 'draw-steel/opposed', 'draw-steel/project', 'draw-steel/save', 'draw-steel/initiative']);
function require(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function integer(value: unknown, min: number, max: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
}
function serializable(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(item => serializable(item, depth + 1));
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.values(value).every(item => serializable(item, depth + 1));
}

/** Throws before generation or resolution. Logical bounds do not promise 3D capacity. */
export function validateRequest(request: RollRequest): void {
  require(request && typeof request === 'object', 'A roll request is required.');
  require(typeof request.requestId === 'string' && request.requestId.length > 0 && request.requestId.length <= 128, 'requestId must contain 1–128 characters.');
  require(rulesets.has(request.ruleset), 'Unsupported ruleset.');
  require(Array.isArray(request.dice) && request.dice.length > 0 && request.dice.length <= MAX_DICE, 'Supply one or more dice groups.');
  const ids = new Set<string>();
  let count = 0;
  for (const [index, group] of request.dice.entries()) {
    require(group && integer(group.sides, 2, MAX_SIDES), 'Die sides must be an integer from 2 to 1000.');
    require(integer(group.count, 1, MAX_DICE), 'Die count must be an integer from 1 to 100.');
    require(group.id === undefined || (typeof group.id === 'string' && group.id.length > 0 && group.id.length <= 128), 'Group IDs must contain 1–128 characters.');
    const id = group.id ?? String(index);
    require(!ids.has(id), 'Dice group IDs must be unique, including implicit IDs.');
    ids.add(id);
    count += group.count;
  }
  require(count <= MAX_DICE, 'A request may contain at most 100 dice.');
  if (request.keep !== undefined) {
    require(request.keep && ['highest', 'lowest'].includes(request.keep.mode), 'Keep mode must be highest or lowest.');
    require(integer(request.keep.count, 1, count), 'Keep count must be between one and the dice count.');
  }
  if (request.modifiers !== undefined) {
    require(request.modifiers && typeof request.modifiers === 'object' && !Array.isArray(request.modifiers), 'Modifiers must be an object.');
    for (const [key, value] of Object.entries(request.modifiers)) {
      require(['characteristic', 'edges', 'banes', 'bonus'].includes(key), 'Unknown modifier.');
      require(integer(value, key === 'edges' || key === 'banes' ? 0 : -10000, 10000), 'Modifiers must be bounded integers; edges and banes cannot be negative.');
    }
  }
  if (request.context !== undefined) {
    require(request.context && !Array.isArray(request.context) && serializable(request.context), 'Context must be bounded JSON data.');
    require(JSON.stringify(request.context).length <= 4096, 'Context must not exceed 4096 characters.');
    require(request.context.label === undefined || typeof request.context.label === 'string', 'Context label must be text.');
    require(request.context.actorId === undefined || typeof request.context.actorId === 'string', 'Context actorId must be text.');
  }
  const kept = request.keep?.count ?? count;
  const allD10 = request.dice.every(group => group.sides === 10);
  if (request.ruleset === 'percentile') {
    require(count === 2 && allD10 && !request.keep, 'Percentiles require two d10s, tens first, with no keep/drop.');
    require(!Object.values(request.modifiers ?? {}).some(value => value !== 0), 'Percentiles do not accept numeric modifiers.');
  }
  if (request.ruleset === 'draw-steel/power' || request.ruleset === 'draw-steel/opposed') {
    require(allD10 && kept === 2, 'Power and opposed rolls require exactly two kept d10s.');
  }
  if (request.ruleset === 'draw-steel/project') {
    require(!request.keep && request.dice[0]?.sides === 10 && request.dice[0].count >= 2, 'Project rolls start with a group of at least two d10s; additional dice are explicit bonuses.');
  }
  if (request.ruleset === 'draw-steel/save' || request.ruleset === 'draw-steel/initiative') {
    require(count === 1 && allD10 && !request.keep, 'Save and initiative rolls require one d10.');
    require(!request.modifiers?.characteristic && !request.modifiers?.edges && !request.modifiers?.banes, 'Save and initiative rolls do not use characteristics, edges or banes.');
  }
  if (request.ruleset === 'sum') require(!request.modifiers?.edges && !request.modifiers?.banes, 'Edges and banes require a Draw Steel power, opposed or project preset.');
}

/** Secure, unbiased logical generation. Fails explicitly if Web Crypto is unavailable. */
export function generateValues(request: RollRequest): number[] {
  validateRequest(request);
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure random generation requires crypto.getRandomValues; supply accepted values to resolveRoll instead.');
  const word = new Uint32Array(1);
  const values: number[] = [];
  for (const group of request.dice) {
    const limit = Math.floor(0x100000000 / group.sides) * group.sides;
    for (let index = 0; index < group.count; index++) {
      let value: number;
      do { globalThis.crypto.getRandomValues(word); value = word[0]!; } while (value >= limit);
      values.push(value % group.sides + 1);
    }
  }
  return values;
}

/** Resolves accepted values without generating, rendering, or executing game effects. */
export function resolveRoll(request: RollRequest, values: number[]): ResolvedResult {
  validateRequest(request);
  require(Array.isArray(values) && values.length === request.dice.reduce((sum, group) => sum + group.count, 0), 'Supply exactly one value per die.');
  const dice: DieResult[] = [];
  for (const [index, group] of request.dice.entries()) {
    for (let die = 0; die < group.count; die++) {
      const value = values[dice.length];
      require(integer(value, 1, group.sides), 'Each die value must be an integer from one to its side count.');
      dice.push({ id: `${group.id ?? index}:${die}`, sides: group.sides, value, kept: true });
    }
  }
  if (request.keep) {
    const order = dice.map((die, index) => ({ value: die.value, index })).sort((a, b) => (request.keep!.mode === 'highest' ? b.value - a.value : a.value - b.value) || a.index - b.index);
    const kept = new Set(order.slice(0, request.keep.count).map(die => die.index));
    dice.forEach((die, index) => { die.kept = kept.has(index); });
  }
  const naturalTotal = dice.filter(die => die.kept).reduce((sum, die) => sum + die.value, 0);
  if (request.ruleset.startsWith('draw-steel/')) return resolveDrawSteel(request, dice);
  if (request.ruleset === 'percentile') {
    // Steel Compendium: en/books/heroes/md/chapter/the-basics.md, D100s.
    const value = (dice[0]!.value % 10) * 10 + dice[1]!.value % 10;
    const total = value === 0 ? 100 : value;
    return { dice, naturalTotal: total, total, summary: `Percentile ${total} (tens ${dice[0]!.value % 10 * 10}, ones ${dice[1]!.value % 10}${value === 0 ? '; double zero means 100' : ''})` };
  }
  const total = naturalTotal + (request.modifiers?.characteristic ?? 0) + (request.modifiers?.bonus ?? 0);
  return { dice, naturalTotal, total, summary: `Total ${total}` };
}

/** Plain semantic text works independently of canvas and transient result overlays. */
export function formatResult(result: ResolvedResult, name?: string, detail = false): string {
  const concise = `${name ? `${name} rolled: ` : ''}${result.summary}.`;
  if (!detail) return concise;
  const dice = result.dice.map(die => `d${die.sides}: ${die.value}${die.kept ? '' : ' (discarded)'}`).join(', ');
  const adjustment = result.total - result.naturalTotal;
  return `${concise} Dice ${dice}. Natural total ${result.naturalTotal}; adjustment ${adjustment >= 0 ? '+' : ''}${adjustment}; final total ${result.total}.`;
}
