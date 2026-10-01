import type { DieResult, ResolvedResult, RollRequest } from "./dice.js";

/** Paths refer to the pinned Steel Compendium; the reference corpus is not bundled. */
export const DRAW_STEEL_SOURCES = {
  power:
    "en/books/heroes/md/rule/dice/power-roll.md#Making a Power Roll / Rolling With Edges and Banes",
  edge: "en/books/heroes/md/rule/dice/edge.md",
  bane: "en/books/heroes/md/rule/dice/bane.md",
  tiers: "en/books/heroes/md/rule/dice/tier-outcome.md",
  natural: "en/books/heroes/md/rule/dice/natural-roll.md",
  critical: "en/books/heroes/md/rule/combat/critical-hit.md",
  opposed: "en/books/heroes/md/rule/dice/opposed-power-roll.md",
  project:
    "en/books/heroes/md/rule/downtime/project-roll.md#Project Roll Edges and Banes",
  save: "en/books/heroes/md/rule/general/saving-throw.md",
  initiative:
    "en/books/heroes/md/rule/combat/combat-round.md#Determine Who Goes First",
  projectBonus: "en/books/heroes/md/title/ancient-loremaster.md#Rare Books",
} as const;

/** Cap each side BEFORE cancellation (Power Rolls, Rolling With Edges and Banes). */
export function netEdges(edges = 0, banes = 0): number {
  return Math.min(2, edges) - Math.min(2, banes);
}

/** Called after the public dice entry validates pool shape and values. No game actions execute. */
export function resolveDrawSteel(
  request: RollRequest,
  dice: DieResult[],
): ResolvedResult {
  const kept = dice.filter((die) => die.kept);
  const base = kept.slice(0, 2).reduce((sum, die) => sum + die.value, 0);
  const pool = kept.reduce((sum, die) => sum + die.value, 0);
  const mods = request.modifiers ?? {};
  const net = netEdges(mods.edges, mods.banes);
  const numeric = (mods.characteristic ?? 0) + (mods.bonus ?? 0);
  const edgeText =
    net === 0
      ? ""
      : `, with ${Math.abs(net) === 2 ? "a double " : net > 0 ? "an " : "a "}${net > 0 ? "edge" : "bane"}`;
  if (
    request.ruleset === "draw-steel/save" ||
    request.ruleset === "draw-steel/initiative"
  ) {
    // Saving Throw; Combat Round, Determine Who Goes First: d10, threshold 6.
    const total = pool + (mods.bonus ?? 0);
    const success = total >= 6;
    const summary =
      request.ruleset === "draw-steel/save"
        ? `Save ${total}, ${success ? "effect ends" : "effect continues"}`
        : `Initiative ${total}, ${success ? "players choose" : "Director chooses"} which side goes first`;
    return { dice, naturalTotal: pool, total, success, summary };
  }
  if (
    request.ruleset === "draw-steel/opposed" ||
    request.ruleset === "draw-steel/project"
  ) {
    // Opposed Power Rolls / Project Roll Edges and Banes use numeric ±2 / ±4.
    const raw = pool + numeric + net * 2;
    const project = request.ruleset === "draw-steel/project";
    const total = project ? Math.max(1, raw) : raw;
    // Project Roll: breakthrough uses the natural power roll, excluding added dice bonuses.
    const breakthrough = project && base >= 19;
    return {
      dice,
      naturalTotal: base,
      total,
      ...(project ? { breakthrough } : {}),
      summary: `${project ? "Project points" : "Opposed total"} ${total}${breakthrough ? ", breakthrough (another project roll available)" : ""}${edgeText}`,
    };
  }
  // Tier Outcomes thresholds; Edge/Bane double shifts; Natural Roll overrides all modifiers.
  const total = base + numeric + (Math.abs(net) === 1 ? net * 2 : 0);
  const initial = total <= 11 ? 1 : total <= 16 ? 2 : 3;
  const tier = (
    base >= 19
      ? 3
      : Math.max(
          1,
          Math.min(3, initial + (Math.abs(net) === 2 ? Math.sign(net) : 0)),
        )
  ) as 1 | 2 | 3;
  // Critical Hit requires an ability roll made as a main action, never a generic high roll.
  const critical =
    base >= 19 &&
    request.context?.rollType === "ability" &&
    request.context?.actionType === "main";
  return {
    dice,
    naturalTotal: base,
    total,
    tier,
    critical,
    summary: `Power roll ${total}, tier ${tier}${critical ? ", critical hit" : ""}${edgeText}`,
  };
}
