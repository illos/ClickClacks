// SPDX-License-Identifier: MIT
import type { Identity } from './session';
import type { AutomaticSession } from '../../lib/client';
import type { SitePreferences } from './storage';
import { applyDocumentTheme, type ColorTheme } from '../dice-demo-v2/theme';
import type { RollControls } from 'clickclacks/react';

export type TraySession = { identity: Identity; roomKey: string; preferences: SitePreferences; automaticSession?: AutomaticSession; controls?: RollControls; onControls?: (controls:RollControls)=>void; onJoin?: (key:string)=>void; roomLink?: (code:string)=>string };
type MiniWindow = Window & { clickclacksTraySession?: TraySession; powerrollerTraySession?: TraySession };
type PictureInPicture = { window: Window | null; requestWindow(options: {width:number;height:number}): Promise<Window> };
const pip = (window as Window & { documentPictureInPicture?: PictureInPicture }).documentPictureInPicture;

/** A PiP iframe shares the opener's participant, without claiming a second tab identity. */
export function traySession(): TraySession | undefined {
  if (document.getElementById('root')?.dataset.popout !== 'true' || parent === window) return;
  try { return (parent as MiniWindow).clickclacksTraySession ?? (parent as MiniWindow).powerrollerTraySession; } catch { return; }
}

export function createTrayPopout() {
  const supported = !!pip && matchMedia('(hover: hover) and (pointer: fine)').matches;
  let mini: MiniWindow | undefined;
  let frame: HTMLIFrameElement | undefined;
  const listeners = new Set<(active: boolean, error: string) => void>();
  let active = false, error = '', opening = false, generation = 0;
  function update(next: boolean, message = '') {
    active = next; error = message;
    for (const listener of listeners) listener(active, error);
  }
  function close() { generation++; mini?.close(); mini = undefined; frame = undefined; update(false); }
  function setControls(controls: RollControls) {
    if (!mini?.powerrollerTraySession || !frame?.contentWindow) return;
    if (JSON.stringify(mini.powerrollerTraySession.controls) === JSON.stringify(controls)) return;
    mini.powerrollerTraySession.controls = controls;
    frame.contentWindow.dispatchEvent(new CustomEvent('clickclacks-controls', {detail:controls}));
  }
  function setTheme(theme: ColorTheme) { if (mini) applyDocumentTheme(theme, mini.document); }
  async function open(session: TraySession) {
    if (!supported || !pip || opening) return;
    if (mini && !mini.closed) {
      if (error) close();
      else { mini.focus(); return; }
    }
    opening = true;
    const version = generation;
    try {
      const target = await pip.requestWindow({width:480, height:420}) as MiniWindow;
      if (version !== generation) { target.close(); return; }
      mini = target;
      target.clickclacksTraySession = session;
      target.powerrollerTraySession = session; // Legacy embedded clients share the same object.
      target.document.title = 'Click Clacks tray';
      const style = target.document.createElement('style');
      style.textContent = 'html,body{margin:0;width:100%;height:100%;overflow:hidden;background:var(--page-bg,#111415);color:var(--page-ink,#e8e5df);font:14px system-ui,sans-serif}html[data-theme=light]{--page-bg:#f4f1eb;--page-ink:#202a2c}iframe{display:block;width:100%;height:100%;border:0}.pip-loading{position:absolute;inset:0;margin:0;padding:24px;background:var(--page-bg,#111415)}.pip-loading[hidden]{display:none}';
      target.document.head.append(style);
      applyDocumentTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark', target.document);
      const loading = target.document.createElement('p');
      loading.className = 'pip-loading'; loading.setAttribute('role', 'status');
      loading.textContent = 'Loading dice tray…';
      const child = target.document.createElement('iframe');
      frame = child;
      child.title = 'Dice tray and roll controls';
      const base = new URL(import.meta.env.BASE_URL, location.origin);
      const address = new URL(import.meta.env.DEV ? 'web/popout/tray.html' : 'web/popout/tray.html', base);
      address.searchParams.set('room', session.roomKey);
      child.src = address.href;
      target.addEventListener('message', event => {
        if (event.origin !== location.origin || event.source !== child.contentWindow) return;
        if (['clickclacks-tray-ready','powerroller-tray-ready'].includes(event.data?.type)) loading.hidden = true;
        if (['clickclacks-tray-error','powerroller-tray-error'].includes(event.data?.type)) {
          loading.hidden = true;
          update(false, 'The floating tray could not load. Close its window and try again.');
        }
      });
      target.addEventListener('pagehide', () => {
        if (mini !== target) return;
        mini = undefined; frame = undefined; update(false);
      }, {once:true});
      target.document.body.append(child, loading);
      update(true);
    } catch {
      update(false, 'Could not open the floating tray. Try again.');
    } finally { opening = false; }
  }
  return { supported, open, close, setControls, setTheme, subscribe(listener: (active:boolean,error:string)=>void) {
    listeners.add(listener); listener(active, error);
    return () => { listeners.delete(listener); };
  } };
}
