// SPDX-License-Identifier: MIT
import { createRoot } from 'react-dom/client';
import { ConvexReactClient } from 'convex/react';
import { ClickClacks } from 'clickclacks/react';
import { createAutomaticSession } from 'clickclacks/client';
import 'clickclacks/styles.css';
const backend = import.meta.env.VITE_CONVEX_URL;
const client = new ConvexReactClient(backend);
const key = new URLSearchParams(location.search).get('room') ?? crypto.randomUUID();
const identity = { viewer: crypto.randomUUID(), credential: crypto.randomUUID() + crypto.randomUUID() };
let profile = { name: 'Solo fixture', style: { color: '#44aa88', ink: '#ffffff', pattern: 'solid' as const, font: 'serif' as const } } as import('../../lib/client').Profile;
let elapsed = 0;
const session = createAutomaticSession(identity, () => Date.now() + elapsed);
let observation: Parameters<typeof session.observe> | undefined;
const observe = session.observe;
session.observe = (...args) => { observation = args; observe(...args); };
// Advance the solo-delay clock without falsifying the backend's presence clock.
(window as any).fixture = { backend, key, identity, advanceSolo(ms: number) {
  elapsed += ms;
  if (observation) observe(...observation);
}, snapshot: session.getSnapshot, participantCount: () => observation?.[0]?.participants.length,
localHistory: () => session.localTransport(profile).call('diceDemoV2:events', { after: 0 }) };
const root = createRoot(document.getElementById('mount')!);
function render(hidden: boolean) {
  root.render(<ClickClacks automaticSession={session} client={client} roomKey={key} identity={identity}
    profile={profile} onProfile={next => { profile = next; }}
    preferences={{ hidden, motion: 'device', highContrast: false, announcements: 'off', sound: true }} />);
}
document.getElementById('show')!.onclick = () => render(false);
document.getElementById('hide')!.onclick = () => render(true);
render(true);
