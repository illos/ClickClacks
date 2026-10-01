// SPDX-License-Identifier: MIT
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexReactClient } from 'convex/react';
import { PowerRoller } from '../../lib/react';
import { parseRoomKey } from '../dice-demo-v2/model';
import { claimIdentity, readIdentity, type Identity } from './session';
import { loadPreferences, savePreferences, saveProfile, rememberRoom, cacheRoll, loadHistory } from './storage';
import '../../lib/styles.css';
import './style.css';

const backend = import.meta.env.VITE_CONVEX_URL as string;
if (!backend) throw new Error('Set VITE_CONVEX_URL to the intended Convex deployment.');
const client = new ConvexReactClient(backend);
const saved = loadPreferences();
const invite = new URLSearchParams(location.search).get('room');
const initialRoom = parseRoomKey(invite ?? '') ?? (saved.roomBackend === backend ? parseRoomKey(saved.room ?? '') : null) ?? crypto.randomUUID();
function Site() {
  const [room, setRoom] = useState(initialRoom);
  const [identity, setIdentity] = useState<Identity>();
  useEffect(() => {
    let active = true;
    const claim = claimIdentity(readIdentity(backend), backend);
    void claim.ready.then(value => { if (active) setIdentity(value); });
    return () => { active = false; claim.dispose(); };
  }, []);
  if (!identity) return null;
  return <PowerRoller client={client} roomKey={room} identity={identity} profile={saved.profile} preferences={saved}
    onPreferences={preferences => savePreferences({ ...preferences, profile: loadPreferences().profile, room: loadPreferences().room, roomBackend: backend })} onProfile={saveProfile}
    onRoom={code => { rememberRoom(code, backend); const address = new URL(location.href); address.searchParams.set('room', code); history.replaceState(null, '', address); }}
    onJoin={setRoom} roomLink={code => { const address = new URL(location.href); address.searchParams.set('room', code); return address.href; }}
    loadHistory={code => loadHistory(backend, code)} onRoll={(code, roll) => cacheRoll(backend, code, roll)} />;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Site /></StrictMode>);
