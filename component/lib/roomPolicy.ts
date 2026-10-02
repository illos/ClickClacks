// SPDX-License-Identifier: MIT
/** Shared backend request validation and community policy; no database access. */
import { authorityError } from "./errors";
import { defaultDice, validateDiceConfiguration, type DiceConfiguration } from "../../shared/dice";
import { sha256, toHex } from "./sha256";
export const validKey = (key: string) => {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key)
  )
    throw authorityError("INVALID_REQUEST","Invalid room link.");
};
export const codePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
export function profile(name: string, style: { color: string; ink: string }) {
  if (
    !name.trim() ||
    name.length > 32 ||
    !/^#[a-f0-9]{6}$/i.test(style.color) ||
    !/^#[a-f0-9]{6}$/i.test(style.ink)
  )
    throw authorityError("INVALID_REQUEST","Choose a name and valid dice colors.");
}
export const defaultPolicy = {
  capacity: 8,
  ttlMs: 86400000,
  receiptTtlMs: 3600000,
  maxRolls: 2000,
  minRollIntervalMs: 250,
};
export function config(dice?: DiceConfiguration) {
  try {
    const checked = validateDiceConfiguration(dice ?? defaultDice);
    return { kind: checked.kind, sides: checked.sides, count: checked.count, ...(checked.bonusD4?{bonusD4:true}:{}) };
  } catch (e) {
    throw authorityError("INVALID_REQUEST",(e as Error).message);
  }
}
export function validCredential(credential: string) {
  if (credential.length < 32 || credential.length > 256)
    throw authorityError("UNAUTHORIZED","Use your private session credential.");
}
export function semanticFingerprint(args: {
  dice?: DiceConfiguration;
  faces: number[];
  edges?: number;
  banes?: number;
}) {
  return toHex(
    sha256(
      new TextEncoder().encode(
        JSON.stringify({
          dice: config(args.dice),
          faces: args.faces,
          edges: args.edges ?? 0,
          banes: args.banes ?? 0,
        }),
      ),
    ),
  );
}
