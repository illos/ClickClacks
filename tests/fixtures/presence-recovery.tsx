// SPDX-License-Identifier: MIT
import { createRoot } from 'react-dom/client';
import { ConvexReactClient } from 'convex/react';
import { getFunctionName, makeFunctionReference } from 'convex/server';
import { ClickClacks } from 'clickclacks/react';
import 'clickclacks/styles.css';
const backend = import.meta.env.VITE_CONVEX_URL;
const client = new ConvexReactClient(backend);
const key = crypto.randomUUID();
const identity = { viewer: crypto.randomUUID(), credential: crypto.randomUUID() + crypto.randomUUID() };
const mutation = client.mutation.bind(client);
let rejectClear = false;
client.mutation = ((method, args) => {
  if (rejectClear && getFunctionName(method) === 'diceDemoV2:clearTray') {
    rejectClear = false;
    return Promise.reject(Object.assign(new Error('Invalid private session credential.'), {
      data: { code: 'UNAUTHORIZED', message: 'Invalid private session credential.' },
    }));
  }
  return mutation(method, args);
}) as typeof client.mutation;
(window as any).fixture = {
  backend, key, identity,
  leave: () => client.mutation(makeFunctionReference<'mutation'>('diceDemoV2:leave'), { key, ...identity }),
  failNextClear: () => { rejectClear = true; },
};
createRoot(document.getElementById('mount')!).render(<ClickClacks client={client} roomKey={key} identity={identity}
  profile={{ name: 'Recovery fixture', style: { color: '#abcdef', ink: '#000000', pattern: 'solid', font: 'serif' } }}
  preferences={{ hidden: true, sound: false, motion: 'reduce', highContrast: false, announcements: 'off' }} />);
