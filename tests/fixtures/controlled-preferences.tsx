// SPDX-License-Identifier: MIT
import { createRoot } from 'react-dom/client';
import { ConvexReactClient } from 'convex/react';
import { PowerRoller } from 'clickclacks/react';
import 'clickclacks/styles.css';
const client = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);
const root = createRoot(document.getElementById('mount')!);
const roomKey = crypto.randomUUID(),
  identity = { viewer: crypto.randomUUID(), credential: crypto.randomUUID() + crypto.randomUUID() };
function render(hidden: boolean) {
  root.render(
    <PowerRoller
      client={client}
      roomKey={roomKey}
      identity={identity}
      profile={{
        name: 'Controlled Host',
        style: { color: '#44aa88', ink: '#ffffff', pattern: 'solid', font: 'serif' },
      }}
      preferences={{ hidden, motion: 'reduce', highContrast: false, announcements: 'off' }}
    />,
  );
}
document.getElementById('show')!.onclick = () => render(false);
document.getElementById('hide')!.onclick = () => render(true);
render(true);
