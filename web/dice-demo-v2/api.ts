// SPDX-License-Identifier: MIT
import { makeFunctionReference } from "convex/server";
import type { DiceConfiguration } from "../../shared/dice";
import type { Style, Motion, Receipt } from "../dice-demo/model";
import type { Room, Track, ParticipantRoll } from "./model";
export const demoV2 = {
  leave: makeFunctionReference<"mutation", {key:string;viewer:string;credential:string},null>("diceDemoV2:leave"),
  events: makeFunctionReference<
    "query",
    {
      key: string;
      viewer: string;
      credential: string;
      after: number;
      limit?: number;
    },
    { rolls: ParticipantRoll[]; cursor: number; hasMore: boolean }
  >("diceDemoV2:events"),
  randomName: makeFunctionReference<"mutation", Record<string, never>, string>(
    "diceDemoV2:randomName",
  ),
  view: makeFunctionReference<"query", { key: string }, Room>(
    "diceDemoV2:view",
  ),
  track: makeFunctionReference<
    "query",
    { key: string; viewer: string; rollId?: string },
    Track | null
  >("diceDemoV2:track"),
  join: makeFunctionReference<
    "mutation",
    {
      key: string;
      viewer: string;
      credential: string;
      name: string;
      style: Style;
      ready: boolean;
      uncertainty: number;
    },
    null
  >("diceDemoV2:join"),
  customize: makeFunctionReference<
    "mutation",
    {
      key: string;
      viewer: string;
      credential: string;
      name: string;
      style: Style;
    },
    null
  >("diceDemoV2:customize"),
  throwDice: makeFunctionReference<
    "mutation",
    {
      key: string;
      viewer: string;
      credential: string;
      id: string;
      dice?: DiceConfiguration;
      faces: number[];
      motion?: Motion;
      edges?: number;
      banes?: number;
    },
    ParticipantRoll
  >("diceDemoV2:throwDice"),
  clearTray: makeFunctionReference<
    "mutation",
    { key: string; viewer: string; credential: string },
    null
  >("diceDemoV2:clearTray"),
  receipt: makeFunctionReference<
    "mutation",
    { key: string; credential: string; roller: string; sample: Receipt },
    null
  >("diceDemoV2:receipt"),
};
