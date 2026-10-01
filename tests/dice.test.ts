import { describe, expect, it } from 'vitest';
import { formatResult, generateValues, resolveRoll, validateRequest, type RollRequest } from '../src/dice.js';
import { netEdges } from '../src/draw-steel.js';

const power = (overrides: Partial<RollRequest> = {}): RollRequest => ({ requestId: 'source-case', dice: [{ sides: 10, count: 2 }], ruleset: 'draw-steel/power', ...overrides });

describe('Draw Steel presets (expectations from pinned Steel Compendium)', () => {
  // en/books/heroes/md/rule/dice/tier-outcome.md: ≤11, 12–16, ≥17.
  it.each([[5, 6, 1], [6, 6, 2], [8, 8, 2], [8, 9, 3]])('natural %i + %i yields tier %i', (a, b, tier) => {
    expect(resolveRoll(power(), [a, b]).tier).toBe(tier);
  });
  // power-roll.md, Rolling With Edges and Banes: each side caps before cancellation.
  it('cancels one bane against any number of edges to one edge', () => {
    expect(netEdges(9, 1)).toBe(1);
    const result = resolveRoll(power({ modifiers: { edges: 9, banes: 1 } }), [6, 9]);
    expect(result.total).toBe(17);
    expect(result.tier).toBe(3);
    expect(netEdges(1, 9)).toBe(-1);
    expect(netEdges(9, 2)).toBe(0);
  });
  // edge.md / bane.md: doubles change tier without adding/subtracting to total.
  it('distinguishes numeric modifiers from double-edge tier movement', () => {
    expect(resolveRoll(power({ modifiers: { edges: 2 } }), [5, 6])).toMatchObject({ total: 11, tier: 2 });
    expect(resolveRoll(power({ modifiers: { banes: 2 } }), [8, 9])).toMatchObject({ total: 17, tier: 2 });
    expect(resolveRoll(power({ modifiers: { characteristic: 2, bonus: -1 } }), [5, 6])).toMatchObject({ naturalTotal: 11, total: 12, tier: 2 });
  });
  // natural-roll.md: natural19/20 ALWAYS tier3; critical-hit.md requires main-action ability.
  it('keeps natural 19 at tier 3 through penalties without granting a generic critical', () => {
    const request = power({ modifiers: { characteristic: -5, bonus: -5, banes: 2 } });
    expect(resolveRoll(request, [9, 10])).toMatchObject({ naturalTotal: 19, total: 9, tier: 3, critical: false });
    expect(resolveRoll({ ...request, context: { rollType: 'ability', actionType: 'main' } }, [9, 10]).critical).toBe(true);
    expect(resolveRoll({ ...request, context: { rollType: 'ability', actionType: 'maneuver' } }, [9, 10]).critical).toBe(false);
  });
  // opposed-power-roll.md: double edges numeric +4, double banes -4; no tiers.
  it('resolves opposed totals without tier or success claims', () => {
    const result = resolveRoll(power({ ruleset: 'draw-steel/opposed', modifiers: { edges: 2 } }), [5, 6]);
    expect(result.total).toBe(15);
    expect(result.tier).toBeUndefined();
    expect(result.success).toBeUndefined();
  });
  // project-roll.md: minimum1, numeric double edges/banes, breakthrough natural19/20.
  // title/ancient-loremaster.md, Rare Books: d6 totals ADD to project roll.
  it('keeps project minimum and breakthrough distinct from bonus dice', () => {
    expect(resolveRoll(power({ ruleset: 'draw-steel/project', modifiers: { bonus: -20, banes: 2 } }), [1, 1])).toMatchObject({ total: 1, breakthrough: false });
    const request = power({ ruleset: 'draw-steel/project', dice: [{ sides: 10, count: 2 }, { sides: 6, count: 1 }], modifiers: { edges: 2 } });
    expect(resolveRoll(request, [9, 10, 4])).toMatchObject({ naturalTotal: 19, total: 27, breakthrough: true });
    expect(resolveRoll(request, [8, 8, 6])).toMatchObject({ naturalTotal: 16, total: 26, breakthrough: false });
  });
  // saving-throw.md / combat-round.md, Determine Who Goes First: one d10, 6+.
  it('describes saves and opening choice without choosing the starting side', () => {
    const single = { dice: [{ sides: 10, count: 1 }] };
    expect(resolveRoll(power({ ...single, ruleset: 'draw-steel/save' }), [5])).toMatchObject({ success: false, summary: 'Save 5, effect continues' });
    expect(resolveRoll(power({ ...single, ruleset: 'draw-steel/save' }), [6]).success).toBe(true);
    expect(resolveRoll(power({ ...single, ruleset: 'draw-steel/initiative' }), [6]).summary).toBe('Initiative 6, players choose which side goes first');
    expect(resolveRoll(power({ ...single, ruleset: 'draw-steel/initiative' }), [5]).summary).toBe('Initiative 5, Director chooses which side goes first');
  });
});

describe('generic dice and accepted result boundaries', () => {
  // chapter/the-basics.md, D100s: 10 means digit0; double0 means100.
  it.each([[5, 3, 53], [10, 9, 9], [9, 10, 90], [10, 10, 100]])('percentile %i / %i means %i', (tens, ones, total) => {
    expect(resolveRoll(power({ ruleset: 'percentile' }), [tens, ones])).toMatchObject({ naturalTotal: total, total });
  });
  it('keeps mixed dice explicit and deterministically discards ties', () => {
    const request = power({ ruleset: 'sum', dice: [{ id: 'small', sides: 3, count: 2 }, { id: 'large', sides: 6, count: 2 }], keep: { mode: 'highest', count: 2 }, modifiers: { bonus: 3 } });
    const result = resolveRoll(request, [3, 1, 3, 6]);
    expect(result).toMatchObject({ naturalTotal: 9, total: 12 });
    expect(result.dice.map(die => die.kept)).toEqual([true, false, false, true]);
    expect(result.dice.map(die => die.id)).toEqual(['small:0', 'small:1', 'large:0', 'large:1']);
    expect(formatResult(result, 'Morgan', true)).toContain('d6: 3 (discarded)');
    expect(resolveRoll({ ...request, keep: { mode: 'lowest', count: 2 } }, [3, 1, 3, 6]).naturalTotal).toBe(4);
  });
  // en/unified/md/feature/beastheart/level-1/rampage.md, 24-point row: 3d10 discard lowest.
  it('supports discard-lowest 3d10 power rolls without losing discarded values', () => {
    const result = resolveRoll(power({ dice: [{ sides: 10, count: 3 }], keep: { mode: 'highest', count: 2 } }), [1, 9, 10]);
    expect(result).toMatchObject({ naturalTotal: 19, tier: 3 });
    expect(result.dice[0]!.kept).toBe(false);
  });
  it('rejects invalid supplied values and misleading preset inputs before resolution', () => {
    expect(() => resolveRoll(power(), [0, 10])).toThrow();
    expect(() => resolveRoll(power(), [10])).toThrow();
    expect(() => resolveRoll(power(), [1.5, 10])).toThrow();
    expect(() => validateRequest(power({ dice: [{ sides: 6, count: 2 }] }))).toThrow();
    expect(() => validateRequest(power({ keep: { mode: 'highest', count: 3 } }))).toThrow();
    expect(() => validateRequest(power({ ruleset: 'sum', modifiers: { edges: 1 } }))).toThrow();
    expect(() => validateRequest(power({ ruleset: 'percentile', modifiers: { bonus: 1 } }))).toThrow();
    expect(() => validateRequest(power({ dice: [{ sides: 1001, count: 2 }] }))).toThrow();
    expect(() => validateRequest(power({ ruleset: 'sum', dice: [{ sides: 3, count: 100 }, { sides: 6, count: 1 }] }))).toThrow();
  });
  it('rejects unserializable context and duplicate implicit/explicit identities', () => {
    expect(() => validateRequest(power({ context: { invalid: undefined } }))).toThrow();
    expect(() => validateRequest(power({ context: { invalid: Number.POSITIVE_INFINITY } }))).toThrow();
    expect(() => validateRequest(power({ context: { text: 'x'.repeat(4097) } }))).toThrow();
    expect(() => validateRequest(power({ dice: [{ id: '1', sides: 10, count: 1 }, { sides: 10, count: 1 }] }))).toThrow();
  });
  it('generates one bounded value per logical die without frontend dependencies', () => {
    const request = power({ ruleset: 'sum', dice: [{ sides: 3, count: 1 }, { sides: 4, count: 1 }, { sides: 6, count: 1 }, { sides: 10, count: 1 }] });
    const values = generateValues(request);
    expect(values).toHaveLength(4);
    values.forEach((value, index) => { expect(value).toBeGreaterThanOrEqual(1); expect(value).toBeLessThanOrEqual(request.dice[index]!.sides); });
  });
});
