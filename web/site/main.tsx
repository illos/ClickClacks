// SPDX-License-Identifier: MIT
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { makeFunctionReference } from 'convex/server';
import { ConvexReactClient } from 'convex/react';
import { PowerRoller, type RollControls } from 'powerroller/react';
import { parseRoomKey } from 'powerroller/client';
import { claimIdentity, readIdentity, type Identity } from './session';
import { randomClassicalName } from './classical-names';
import { createTrayPopout, traySession } from './popout';
import { loadPreferences, savePreferences, saveProfile, rememberRoom, cacheRoll, loadHistory } from './storage';
import 'powerroller/styles.css';
import './style.css';

const backend = import.meta.env.VITE_CONVEX_URL as string;
if (!backend) throw new Error('Set VITE_CONVEX_URL to the intended Convex deployment.');
const client = new ConvexReactClient(backend);
const miniSession = traySession();
const saved = miniSession?.preferences ?? loadPreferences();
const popout = createTrayPopout();
const invite = new URLSearchParams(location.search).get('room');
const initialRoom = miniSession?.roomKey ?? parseRoomKey(invite ?? '') ?? (saved.roomBackend === backend ? parseRoomKey(saved.room ?? '') : null) ?? crypto.randomUUID();
function Site() {
  const [room, setRoom] = useState(initialRoom);
  const [identity, setIdentity] = useState<Identity | undefined>(miniSession?.identity);
  const [preferences, setPreferences] = useState(saved);
  const [popoutActive, setPopoutActive] = useState(false);
  const [popoutError, setPopoutError] = useState('');
  const [controls, setControls] = useState<RollControls | undefined>(miniSession?.controls);
  function updateControls(next: RollControls) {
    setControls(old => {
      const value = {...next, readyAt:Math.max(old?.readyAt ?? 0, next.readyAt ?? 0)};
      return JSON.stringify(old) === JSON.stringify(value) ? old : value;
    });
    miniSession?.onControls?.(next);
  }
  function joinTable(key: string) {
    setControls(undefined);
    setRoom(key);
    miniSession?.onJoin?.(key);
  }
  function roomLink(code: string) {
    if (miniSession?.roomLink) return miniSession.roomLink(code);
    const address = new URL(location.href);
    address.searchParams.set('room', code);
    return address.href;
  }
  useEffect(() => {
    if (miniSession) return;
    let active = true;
    const claim = claimIdentity(readIdentity(backend), backend);
    void claim.ready.then(value => { if (active) setIdentity(value); });
    return () => { active = false; claim.dispose(); };
  }, []);
  useEffect(() => popout.subscribe((active, error) => { setPopoutActive(active); setPopoutError(error); }), []);
  useEffect(() => () => popout.close(), [room]);
  useEffect(() => { if (controls) popout.setControls(controls); }, [controls]);
  useEffect(() => {
    if (!miniSession) return;
    const update = (event: Event) => updateControls((event as CustomEvent<RollControls>).detail);
    addEventListener('powerroller-controls', update);
    return () => removeEventListener('powerroller-controls', update);
  }, []);
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === 'powerroller.preferences.v2') setPreferences(loadPreferences());
    };
    addEventListener('storage', refresh);
    return () => removeEventListener('storage', refresh);
  }, []);
  useEffect(() => {
    if (parseRoomKey(invite ?? '') || saved.roomBackend !== backend || !saved.room) return;
    let active = true;
    void client.query(makeFunctionReference<'query', {key:string}, {code:string|null;expired:boolean}>('diceDemoV2:view'), {key: initialRoom}).then(view => {
      if (active && (!view.code || view.expired)) { const fresh = crypto.randomUUID(); setRoom(fresh); rememberRoom(fresh, backend); }
    }).catch(() => { /* Keep the saved room during a temporary connection failure. */ });
    return () => { active = false; };
  }, []);
  if (!identity) return null;
  return <PowerRoller client={client} roomKey={room} identity={identity} profile={preferences.profile} preferences={preferences} nameProvider={randomClassicalName}
    trayHistory={document.getElementById('root')?.dataset.trayHistory === 'true'}
    onPopout={!miniSession && popout.supported ? () => void popout.open({identity, roomKey:room, preferences:loadPreferences(), controls, onControls:updateControls, onJoin:joinTable, roomLink}) : undefined}
    popoutActive={popoutActive} popoutError={popoutError}
    controls={controls} onControls={updateControls}
    onPreferences={value => { savePreferences({ ...value, profile: loadPreferences().profile, room: loadPreferences().room, roomBackend: backend }); setPreferences(loadPreferences()); }}
    onProfile={profile => { saveProfile(profile); setPreferences(loadPreferences()); }}
    onRoom={code => { rememberRoom(code, backend); const address = new URL(location.href); address.searchParams.set('room', code); history.replaceState(null, '', address); }}
    onJoin={joinTable} roomLink={roomLink}
    loadHistory={code => loadHistory(backend, code)} onRoll={(code, roll) => cacheRoll(backend, code, roll)} />;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Site /></StrictMode>);
