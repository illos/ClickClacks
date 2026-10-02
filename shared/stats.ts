// SPDX-License-Identifier: MIT
export type StatsPeriod = "day" | "month" | "all";
export const dayOf = (time: number) => new Date(time).toISOString().slice(0, 10);
export const monthOf = (time: number) => dayOf(time).slice(0, 7);
export function periodKeys(time: number) {
  return [`day:${dayOf(time)}`, `month:${monthOf(time)}`, "all"];
}
export function periodKey(period: StatsPeriod, time: number) {
  return period === "day" ? `day:${dayOf(time)}` : period === "month" ? `month:${monthOf(time)}` : "all";
}
export function validPeriodKey(key: string) {
  if (key === "all") return true;
  if (/^month:\d{4}-(0[1-9]|1[0-2])$/.test(key)) return true;
  if (!/^day:\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const date = key.slice(4), time = Date.parse(date);
  return Number.isFinite(time) && dayOf(time) === date;
}
export const demoRoomPrefix = "de000000-";
export const newDemoRoomKey = () => demoRoomPrefix + crypto.randomUUID().slice(9);
export function emptyGameplay() {
  return {multiplayerTables: 0, sessionsStarted: 0, sessionsCompleted: 0, playerArrivals: 0,
    peakPlayers: 0, multiplayerMs: 0, playerMs: 0, completedMs: 0};
}
export type GameplayStats = ReturnType<typeof emptyGameplay>;
export type TrafficStats = {visitors: number; visits: number; countries: {country: string; visits: number}[]};
export type StatsSnapshot = {
  period: StatsPeriod; generatedAt: number; startedAt: number | null;
  gameplay: GameplayStats; traffic: {website: TrafficStats; app: TrafficStats};
  daily: {day: string; website: number; app: number}[];
};
