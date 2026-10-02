// SPDX-License-Identifier: MIT
import { historyDeadline } from '../dice-demo-v2/history-deadline';
import type { ParticipantRoll, Style } from 'powerroller/client';
export type Profile = { name: string; style: Style };
export type SitePreferences = { theme?: 'system' | 'light' | 'dark'; profile?: Profile; room?: string; roomBackend?: string; sound?: boolean; selectedDice?: 'power' | 'percentile' | 4 | 6 | 8 | 10 | 12 | 20; motion: 'device' | 'reduce' | 'full'; hidden: boolean; highContrast: boolean; announcements: 'all' | 'mine' | 'off' };
const key = 'powerroller.preferences.v2';
const defaults: SitePreferences = { theme: 'system', sound: false, selectedDice: 'power', motion: 'device', hidden: false, highContrast: false, announcements: 'all' };
let preferenceMemoryOnly = false;
let preferenceMemory: SitePreferences = { ...defaults };
export function loadPreferences(): SitePreferences {
  if (preferenceMemoryOnly) return { ...preferenceMemory };
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (saved?.version !== 2) return { ...defaults };
    const p = saved.preferences;
    const style = p?.profile?.style;
    const profile = typeof p?.profile?.name === 'string' && p.profile.name.trim() && p.profile.name.length <= 32 && /^#[a-f\d]{6}$/i.test(style?.color ?? '') && /^#[a-f\d]{6}$/i.test(style?.ink ?? '') && ['solid','speckle','marble','frosted'].includes(style?.pattern) && [undefined,'serif','modern','rune','gothic'].includes(style?.font)
      ? { name: p.profile.name, style: { color: style.color, ink: style.ink, pattern: style.pattern, ...(style.font ? {font:style.font} : {}) } } : undefined;
    return { theme: ['system','light','dark'].includes(p?.theme) ? p.theme : 'system', sound: p?.sound === true, selectedDice: ['power','percentile',4,6,8,10,12,20].includes(p?.selectedDice) ? p.selectedDice : 'power', profile, room: typeof p?.room === 'string' ? p.room : undefined, roomBackend: typeof p?.roomBackend === 'string' ? p.roomBackend : undefined, motion: ['device','reduce','full'].includes(p?.motion) ? p.motion : 'device', hidden: p?.hidden === true, highContrast: p?.highContrast === true, announcements: ['all','mine','off'].includes(p?.announcements) ? p.announcements : 'all' };
  } catch { return { ...preferenceMemory }; }
}
export function savePreferences(preferences: SitePreferences) {
  preferenceMemory = { ...preferences };
  try { localStorage.setItem(key, JSON.stringify({ version: 2, preferences })); preferenceMemoryOnly = false; } catch { preferenceMemoryOnly = true; }
}
export function loadProfile() { return loadPreferences().profile; }
export function saveProfile(profile: Profile) { savePreferences({ ...loadPreferences(), profile }); }
export function rememberRoom(room: string, backend?: string) { savePreferences({ ...loadPreferences(), room, roomBackend: backend }); }
export type CachedRoll = Omit<ParticipantRoll, 'motion'>;
const historyLimit = 1000;
const globalHistoryLimit = 10000;
const historyTtl = 3600000;
type Entry = {
  key: string; backend: string; room: string; savedAt: number;
  startsAt: number; expiresAt: number; roll: CachedRoll;
};
let memory: Entry[] = [];
let writes: Promise<void> = Promise.resolve();
function compact(roll: ParticipantRoll): CachedRoll {
  const { motion: _motion, ...value } = roll;
  return value;
}
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('powerroller.history.v2', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains('rolls')
        ? request.transaction!.objectStore('rolls')
        : db.createObjectStore('rolls', { keyPath: 'key' });
      store.createIndex('roomStartsAt', ['backend', 'room', 'startsAt']);
      store.createIndex('expiresAt', 'expiresAt');
      store.createIndex('savedAt', 'savedAt');
      // Migrate in place, retaining original result timestamps and storage keys.
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (!row) return;
        const entry = row.value as Entry;
        if (!validEntry(entry) || historyDeadline(entry.roll) <= Date.now()) row.delete();
        else row.update({ ...entry, roll: compact(entry.roll as ParticipantRoll), startsAt: entry.roll.startsAt, expiresAt: historyDeadline(entry.roll) });
        row.continue();
      };
    };
    let blocked = false;
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error('History storage upgrade is blocked.')); };
  });
}
function validEntry(entry: Entry): boolean {
  const roll = entry?.roll;
  return typeof entry?.key === 'string' && typeof entry.backend === 'string' && typeof entry.room === 'string' && Number.isFinite(entry.savedAt) && !!roll && typeof roll.id === 'string' && typeof roll.roller === 'string' && typeof roll.name === 'string' && Number.isFinite(roll.startsAt) && roll.startsAt >= 0 && roll.startsAt <= 8.64e15 && Array.isArray(roll.faces) && roll.faces.length > 0 && roll.faces.length <= 100 && roll.faces.every(face => Number.isInteger(face) && face > 0 && face <= 1000) && Array.isArray(roll.styles) && roll.styles.length > 0 && roll.styles.every(style => /^#[a-f\d]{6}$/i.test(style?.color ?? '') && /^#[a-f\d]{6}$/i.test(style?.ink ?? '') && ['solid','speckle','marble','frosted'].includes(style?.pattern) && [undefined,'serif','modern','rune','gothic'].includes(style?.font)) && (roll.total === undefined || Number.isFinite(roll.total)) && (roll.modifier === undefined || Number.isFinite(roll.modifier)) && (!roll.power || Number.isFinite(roll.power.total) && [1,2,3].includes(roll.power.tier) && [0,1,2].includes(roll.power.edges) && [0,1,2].includes(roll.power.banes));
}
function selected(entries: Entry[], backend: string, room: string) {
  const now = Date.now();
  return entries.filter(entry => validEntry(entry) && entry.backend === backend && entry.room === room && historyDeadline(entry.roll) > now)
    .sort((a, b) => b.roll.startsAt - a.roll.startsAt).slice(0, historyLimit);
}
function roomRange(backend: string, room: string) {
  return IDBKeyRange.bound([backend, room, 0], [backend, room, 8.64e15]);
}
export async function loadHistory(backend: string, room: string): Promise<CachedRoll[]> {
  let db: IDBDatabase | undefined;
  try {
    await writes;
    db = await database();
    return await new Promise<CachedRoll[]>((resolve, reject) => {
      const tx = db!.transaction('rolls', 'readwrite');
      const store = tx.objectStore('rolls');
      const expired = store.index('expiresAt').openCursor(IDBKeyRange.upperBound(Date.now()));
      expired.onsuccess = () => { const cursor = expired.result; if (cursor) { cursor.delete(); cursor.continue(); } };
      const request = store.index('roomStartsAt').openCursor(roomRange(backend, room), 'prev');
      const results: CachedRoll[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || results.length >= historyLimit) return;
        const entry = cursor.value as Entry;
        if (validEntry(entry) && historyDeadline(entry.roll) > Date.now()) results.push(entry.roll);
        cursor.continue();
      };
      tx.oncomplete = () => resolve(results);
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('History read failed.'));
    });
  } catch { return selected(memory, backend, room).map(entry => entry.roll); }
  finally { db?.close(); }
}
async function writeRoll(backend: string, room: string, roll: ParticipantRoll) {
  const entry: Entry = {
    key: JSON.stringify([backend, room, roll.roller, roll.id]), backend, room,
    savedAt: Date.now(), startsAt: roll.startsAt, expiresAt: historyDeadline(roll), roll: compact(roll),
  };
  if (!validEntry(entry) || entry.expiresAt <= Date.now()) return;
  const others = memory.filter(value => value.key !== entry.key && validEntry(value) && historyDeadline(value.roll) > Date.now());
  memory = selected([...others, entry], backend, room)
    .concat(others.filter(value => value.backend !== backend || value.room !== room))
    .sort((a, b) => b.savedAt - a.savedAt).slice(0, globalHistoryLimit);
  let db: IDBDatabase | undefined;
  try {
    db = await database();
    await new Promise<void>((resolve, reject) => {
      // One read/write transaction serializes with other tabs: pruning never writes
      // a stale getAll snapshot over a roll concurrently saved in another window.
      const tx = db!.transaction('rolls', 'readwrite');
      const store = tx.objectStore('rolls');
      store.put(entry);
      const globalPrune = () => {
        const total = store.count();
        total.onsuccess = () => {
          let excess = total.result - globalHistoryLimit;
          if (excess <= 0) return;
          const oldest = store.index('savedAt').openCursor();
          oldest.onsuccess = () => {
            const cursor = oldest.result;
            if (cursor && excess-- > 0) { cursor.delete(); cursor.continue(); }
          };
        };
      };
      const roomPrune = () => {
        let skipped = false;
        const roomRows = store.index('roomStartsAt').openCursor(roomRange(backend, room), 'prev');
        roomRows.onsuccess = () => {
          const cursor = roomRows.result;
          if (!cursor) { globalPrune(); return; }
          if (!skipped) { skipped = true; cursor.advance(historyLimit); }
          else { cursor.delete(); cursor.continue(); }
        };
      };
      const expired = store.index('expiresAt').openCursor(IDBKeyRange.upperBound(Date.now()));
      expired.onsuccess = () => {
        const cursor = expired.result;
        if (cursor) { cursor.delete(); cursor.continue(); } else roomPrune();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('History write failed.'));
    });
  } catch { /* Storage is optional; the compact memory history remains usable. */ }
  finally { db?.close(); }
}
export function cacheRoll(backend: string, room: string, roll: ParticipantRoll): Promise<void> {
  const write = writes.then(() => writeRoll(backend, room, roll));
  writes = write.catch(() => {});
  return write;
}
