// SPDX-License-Identifier: MIT
import { createRoot } from 'react-dom/client';
import { ConvexReactClient } from 'convex/react';
import { PowerRoller } from '../../lib/react';
import '../../lib/styles.css';
const client = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);
const preferences = {
  motion: 'device' as const,
  hidden: true,
  highContrast: false,
  announcements: 'off' as const,
};
for (const [index, host] of ['first', 'second'].entries()) {
  createRoot(document.getElementById(host)!).render(
    <PowerRoller
      client={client}
      roomKey={crypto.randomUUID()}
      identity={{
        viewer: crypto.randomUUID(),
        credential: crypto.randomUUID() + crypto.randomUUID(),
      }}
      profile={{
        name: index ? 'Second player' : 'First player',
        style: {
          color: index ? '#dd7722' : '#44aa88',
          ink: '#ffffff',
          pattern: 'solid',
          font: 'serif',
        },
      }}
      preferences={preferences}
    />,
  );
}
