// SPDX-License-Identifier: MIT
export type Identity = { viewer: string; credential: string };
const backend = () => import.meta.env.VITE_CONVEX_URL as string;
const identityKey = (url: string) => `powerroller.identity.v1:${url}`;
function fresh(): Identity {
  return { viewer: crypto.randomUUID(), credential: crypto.randomUUID() + crypto.randomUUID() };
}
function save(identity: Identity, url: string) {
  try { sessionStorage.setItem(identityKey(url), JSON.stringify(identity)); } catch {}
}
export function readIdentity(url = backend()): Identity {
  try {
    const value = JSON.parse(sessionStorage.getItem(identityKey(url)) ?? 'null');
    if (/^[a-f0-9-]{36}$/.test(value?.viewer ?? '') && typeof value?.credential === 'string' && value.credential.length >= 64) return value;
  } catch {}
  const identity = fresh();
  save(identity, url);
  return identity;
}
/** An opener/duplicated tab can copy sessionStorage: keep it a distinct participant. */
export function claimIdentity(initial: Identity, url = backend()) {
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(`powerroller.sessions.v1:${url}`) : undefined;
  const nonce = crypto.randomUUID();
  let identity = initial, owned = false, occupied = false, disposed = false;
  channel?.addEventListener('message', ({ data }) => {
    if (data?.type === 'probe' && owned && data.viewer === identity.viewer && data.nonce !== nonce)
      channel?.postMessage({ type: 'occupied', nonce: data.nonce });
    if (data?.type === 'occupied' && data.nonce === nonce) occupied = true;
  });
  const ready = new Promise<Identity>(resolve => {
    if (!channel) { owned = true; resolve(identity); return; }
    channel.postMessage({ type: 'probe', viewer: identity.viewer, nonce });
    setTimeout(() => {
      if (!disposed && occupied) { identity = fresh(); save(identity, url); }
      owned = !disposed;
      resolve(identity);
    }, 200);
  });
  return { ready, dispose() { disposed = true; owned = false; channel?.close(); } };
}
