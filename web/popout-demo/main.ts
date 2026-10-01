// SPDX-License-Identifier: MIT
import './page.css';

type PictureInPicture = {
  window: Window | null;
  requestWindow(options: { width: number; height: number }): Promise<Window>;
};
const pip = (window as Window & { documentPictureInPicture?: PictureInPicture })
  .documentPictureInPicture;
const button = document.querySelector<HTMLButtonElement>('#open-tray')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;

if (!pip) {
  button.disabled = true;
  status.textContent = 'Document Picture-in-Picture is unavailable in this browser.';
} else {
  button.addEventListener('click', () => void openTray());
}

async function openTray() {
  if (!pip) return;
  if (pip.window && !pip.window.closed) {
    pip.window.focus();
    return;
  }
  button.disabled = true;
  let mini: Window | undefined;
  try {
    mini = await pip.requestWindow({ width: 480, height: 420 });
    mini.document.title = 'Power Roller tray';
    const style = mini.document.createElement('style');
    style.textContent = 'html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#111415;color:#e8e5df;font:14px system-ui,sans-serif}iframe{display:block;width:100%;height:100%;border:0}.pip-loading{position:absolute;inset:0;margin:0;padding:24px;background:#111415}.pip-loading[hidden]{display:none}';
    mini.document.head.append(style);
    const loading = mini.document.createElement('p');
    loading.className = 'pip-loading';
    loading.setAttribute('role', 'status');
    loading.textContent = 'Loading dice tray…';
    // Run the unchanged roller in its own document so its visibility, audio,
    // pointer events and animation clock follow the floating window's lifecycle.
    const frame = mini.document.createElement('iframe');
    frame.title = 'Dice tray and roll controls';
    frame.src = new URL('./tray.html', location.href).href;
    mini.addEventListener('message', event => {
      if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
      if (event.data?.type === 'powerroller-tray-ready') {
        loading.hidden = true;
        status.textContent = 'Tray is open. Close its window to finish.';
      }
      if (event.data?.type === 'powerroller-tray-error') {
        loading.hidden = true;
        status.textContent = 'The tray could not load. Close its window and try again.';
      }
    });
    mini.document.body.append(frame, loading);
    status.textContent = 'Loading tray in the PiP window…';
    button.textContent = 'Focus tray';
    mini.addEventListener('pagehide', () => {
      status.textContent = 'Tray closed. You can open it again.';
      button.textContent = 'Pop out tray';
    }, { once: true });
  } catch {
    status.textContent = 'Could not open the tray. Click the button to try again.';
    if (mini?.document.body) {
      const error = mini.document.createElement('p');
      error.setAttribute('role', 'alert');
      error.style.padding = '24px';
      error.textContent = 'The tray could not open. Close this window and try again.';
      mini.document.body.replaceChildren(error);
    }
  } finally {
    button.disabled = false;
  }
}
