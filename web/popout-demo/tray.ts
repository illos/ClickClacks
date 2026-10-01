// SPDX-License-Identifier: MIT
const message = document.querySelector<HTMLParagraphElement>('#boot-message')!;
const observer = new MutationObserver(() => {
  if (!document.querySelector('.roll-button-group')) return;
  message.hidden = true;
  observer.disconnect();
  parent.postMessage({ type: 'powerroller-tray-ready' }, location.origin);
});
observer.observe(document.getElementById('root')!, { childList: true, subtree: true });
void (async () => {
  try {
    await import('../site/main');
    await import('./tray.css');
  } catch {
    observer.disconnect();
    message.hidden = false;
    message.setAttribute('role', 'alert');
    message.textContent = 'The tray could not load. Close this window and try again.';
    parent.postMessage({ type: 'powerroller-tray-error' }, location.origin);
  }
})();
