// SPDX-License-Identifier: MIT
/** Optional browser presentation. Importing this entry does not mount a tray or start a worker. */
export { createRoomTray } from '../web/dice-demo-v2/renderer';
export type { TrayPreferences } from '../web/dice-demo-v2/renderer';
export { createThrowPlanner } from '../web/dice-demo/prepare-throw';
export { packMotion, unpackMotion, unpackRoll } from '../web/dice-demo/motion-codec';
export { estimateClock, progress } from '../web/dice-demo/model';
export { revealDelay, trayOpacity } from '../web/dice-demo-v2/model';
export type { Style, DiceFont, DiceConfig, Motion, Roll, Receipt, ThrowScene, RestingDie } from '../web/dice-demo/model';
export type { Participant, ParticipantRoll, Track, Room } from '../web/dice-demo-v2/model';
export type { Timing } from "../web/dice-demo/renderer";

export { loadDiceFonts } from '../web/dice-demo/fonts';
