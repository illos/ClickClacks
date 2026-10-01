// SPDX-License-Identifier: MIT
import type { AcceptedRoll, Appearance, Session } from "../../src/client";
import palette from "./palette.json";
export type Preferences = {
  name: string;
  appearance: Appearance;
  motion: "device" | "reduce" | "full";
  hidden: boolean;
  highContrast: boolean;
  announcements: "all" | "mine" | "off";
  roomId?: string;
};
const key = "powerroller.preferences.v1";
const appearanceOnly = (value: Appearance): Appearance => ({
  color: value.color,
  ink: value.ink,
  pattern: value.pattern,
  font: value.font,
});
const defaults = (): Preferences => ({
  name: ["Copper Fox", "Silver Finch", "Amber Otter", "Indigo Hare"][
    crypto.getRandomValues(new Uint8Array(1))[0]! % 4
  ]!,
  appearance: appearanceOnly(
    palette.palette[
      crypto.getRandomValues(new Uint8Array(1))[0]! % palette.palette.length
    ]! as Appearance,
  ),
  motion: "device",
  hidden: false,
  highContrast: false,
  announcements: "all",
});
export function loadPreferences(): Preferences {
  const base = defaults();
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!v || v.version !== 1) return base;
    const p = v.preferences;
    return {
      ...base,
      ...p,
      name: typeof p.name === "string" ? p.name.slice(0, 60) : base.name,
      appearance:
        p.appearance &&
        ["solid", "speckle", "marble", "frosted"].includes(
          p.appearance.pattern,
        ) &&
        ["serif", "modern", "rune", "gothic"].includes(p.appearance.font) &&
        /^#[a-f0-9]{6}$/i.test(p.appearance.color) &&
        /^#[a-f0-9]{6}$/i.test(p.appearance.ink)
          ? appearanceOnly(p.appearance)
          : base.appearance,
      motion: ["device", "reduce", "full"].includes(p.motion)
        ? p.motion
        : "device",
      announcements: ["all", "mine", "off"].includes(p.announcements)
        ? p.announcements
        : "all",
      hidden: p.hidden === true,
      highContrast: p.highContrast === true,
      roomId:
        typeof p.roomId === "string" && p.roomId.length > 0
          ? p.roomId
          : undefined,
    };
  } catch {
    return base;
  }
}
export function savePreferences(p: Preferences) {
  try {
    localStorage.setItem(key, JSON.stringify({ version: 1, preferences: p }));
  } catch {
    /* memory state remains usable */
  }
}
export function saveSession(backend: string, s: Session) {
  try {
    sessionStorage.setItem(
      "powerroller.session.v1",
      JSON.stringify({ backend, ...s }),
    );
  } catch {}
}
export function loadSession(
  backend: string,
  roomId?: string,
): Session | undefined {
  try {
    const s = JSON.parse(
      sessionStorage.getItem("powerroller.session.v1") ?? "null",
    );
    if (
      s?.backend === backend &&
      (!roomId || roomId === s.roomId) &&
      typeof s.roomId === "string" &&
      s.roomId.length > 0 &&
      typeof s.credential === "string" &&
      s.credential.length >= 32 &&
      typeof s.memberId === "string" &&
      s.memberId.length > 0
    )
      return s;
  } catch {}
  return undefined;
}
let memory: {
  backend: string;
  roomId: string;
  roll: AcceptedRoll;
  savedAt: number;
}[] = [];
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("powerroller.history.v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("rolls", { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function historyFor(
  backend: string,
  roomId: string,
): Promise<AcceptedRoll[]> {
  try {
    const db = await database();
    const records = await new Promise<any[]>((resolve, reject) => {
      const r = db.transaction("rolls").objectStore("rolls").getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    db.close();
    return records
      .filter(
        (x) =>
          x.backend === backend &&
          x.roomId === roomId &&
          x.savedAt > Date.now() - 30 * 86400000,
      )
      .map((x) => x.roll)
      .sort((a, b) => a.sequence - b.sequence)
      .slice(-1000);
  } catch {
    return memory
      .filter(
        (x) =>
          x.backend === backend &&
          x.roomId === roomId &&
          x.savedAt > Date.now() - 30 * 86400000,
      )
      .map((x) => x.roll)
      .sort((a, b) => a.sequence - b.sequence);
  }
}
export async function cacheRoll(
  backend: string,
  roomId: string,
  roll: AcceptedRoll,
) {
  memory = [
    ...memory.filter(
      (x) =>
        !(
          x.backend === backend &&
          x.roomId === roomId &&
          x.roll.id === roll.id
        ),
    ),
    { backend, roomId, roll, savedAt: Date.now() },
  ].slice(-1000);
  try {
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("rolls", "readwrite"),
        store = tx.objectStore("rolls");
      store.put({
        key: `${backend}|${roomId}|${roll.id}`,
        backend,
        roomId,
        roll,
        savedAt: Date.now(),
      });
      const all = store.getAll();
      all.onsuccess = () => {
        const rows = all.result.sort((a, b) => b.savedAt - a.savedAt);
        rows.forEach((row, i) => {
          if (i >= 1000 || row.savedAt < Date.now() - 30 * 86400000)
            store.delete(row.key);
        });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {}
}
export async function resetHistory() {
  memory = [];
  try {
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("rolls", "readwrite");
      tx.objectStore("rolls").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {}
}
