// SPDX-License-Identifier: MIT
import type { ParticipantRoll } from '../dice-demo-v2/model';
import type { Style } from '../dice-demo/model';
export type Profile = { name: string; style: Style };
export type SitePreferences = { profile?: Profile; room?: string; roomBackend?: string; motion: 'device' | 'reduce' | 'full'; hidden: boolean; highContrast: boolean; announcements: 'all' | 'mine' | 'off' };
const key = 'powerroller.preferences.v2';
const defaults: SitePreferences = { motion: 'device', hidden: false, highContrast: false, announcements: 'all' };
let preferenceMemory: SitePreferences = { ...defaults };
export function loadPreferences(): SitePreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (saved?.version !== 2) return { ...defaults };
    const p = saved.preferences;
    const style = p?.profile?.style;
    const profile = typeof p?.profile?.name === 'string' && p.profile.name.trim() && p.profile.name.length <= 32 && /^#[a-f\d]{6}$/i.test(style?.color ?? '') && /^#[a-f\d]{6}$/i.test(style?.ink ?? '') && ['solid','speckle','marble','frosted'].includes(style?.pattern) && [undefined,'serif','modern','rune','gothic'].includes(style?.font)
      ? { name: p.profile.name, style: { color: style.color, ink: style.ink, pattern: style.pattern, ...(style.font ? {font:style.font} : {}) } } : undefined;
    return { profile, room: typeof p?.room === 'string' ? p.room : undefined, roomBackend: typeof p?.roomBackend === 'string' ? p.roomBackend : undefined, motion: ['device','reduce','full'].includes(p?.motion) ? p.motion : 'device', hidden: p?.hidden === true, highContrast: p?.highContrast === true, announcements: ['all','mine','off'].includes(p?.announcements) ? p.announcements : 'all' };
  } catch { return { ...preferenceMemory }; }
}
export function savePreferences(preferences: SitePreferences) {
  preferenceMemory = { ...preferences };
  try { localStorage.setItem(key, JSON.stringify({ version: 2, preferences })); } catch {}
}
export function loadProfile() { return loadPreferences().profile; }
export function saveProfile(profile: Profile) { savePreferences({ ...loadPreferences(), profile }); }
export function rememberRoom(room: string, backend?: string) { savePreferences({ ...loadPreferences(), room, roomBackend: backend }); }
export type CachedRoll = Omit<ParticipantRoll, 'motion'>;
const historyLimit = 1000, historyTtl = 30 * 86400000;
type Entry = { key: string; backend: string; room: string; savedAt: number; roll: CachedRoll };
let memory: Entry[] = [];
function compact(roll: ParticipantRoll): CachedRoll { const { motion: _motion, ...value } = roll; return value; }
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('powerroller.history.v2', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('rolls', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function validEntry(entry: Entry): boolean {
  const roll = entry?.roll;
  return typeof entry?.key === 'string' && typeof entry.backend === 'string' && typeof entry.room === 'string' && Number.isFinite(entry.savedAt) && !!roll && typeof roll.id === 'string' && typeof roll.roller === 'string' && typeof roll.name === 'string' && Number.isFinite(roll.startsAt) && Array.isArray(roll.faces) && roll.faces.length > 0 && roll.faces.every(face => Number.isInteger(face) && face > 0) && Array.isArray(roll.styles) && roll.styles.every(style => typeof style?.color === 'string' && typeof style?.ink === 'string');
}
function selected(entries: Entry[], backend: string, room: string) {
  return entries.filter(entry => validEntry(entry) && entry.backend === backend && entry.room === room && entry.savedAt > Date.now() - historyTtl)
    .sort((a,b) => b.roll.startsAt - a.roll.startsAt).slice(0,historyLimit);
}
export async function loadHistory(backend: string, room: string): Promise<CachedRoll[]> {
  try {
    const db = await database();
    const entries = await new Promise<Entry[]>((resolve,reject) => { const request = db.transaction('rolls').objectStore('rolls').getAll(); request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); });
    db.close();
    return selected(entries,backend,room).map(entry=>entry.roll);
  } catch { return selected(memory,backend,room).map(entry=>entry.roll); }
}
export async function cacheRoll(backend: string, room: string, roll: ParticipantRoll) {
  const entry: Entry = { key: JSON.stringify([backend,room,roll.roller,roll.id]), backend, room, savedAt:Date.now(), roll:compact(roll) };
  memory = selected([...memory.filter(value=>value.key!==entry.key),entry],backend,room).concat(memory.filter(value=>value.backend!==backend||value.room!==room)).filter(value=>value.savedAt>Date.now()-historyTtl).sort((a,b)=>b.savedAt-a.savedAt).slice(0,10000);
  try {
    const db=await database();
    const entries=await new Promise<Entry[]>((resolve,reject)=>{const request=db.transaction('rolls').objectStore('rolls').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const keep=new Set(selected([...entries.filter(value=>value.key!==entry.key),entry],backend,room).map(value=>value.key));
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction('rolls','readwrite'),store=tx.objectStore('rolls');store.put(entry);for(const old of entries)if(old.savedAt<=Date.now()-historyTtl||old.backend===backend&&old.room===room&&!keep.has(old.key))store.delete(old.key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
    db.close();
  } catch {}
}
