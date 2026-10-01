// SPDX-License-Identifier: MIT
export {};
const message = document.querySelector<HTMLParagraphElement>('#boot-message')!;
const observer = new MutationObserver(() => {
  if (!document.querySelector('.roll-button-group')) return;
  message.hidden = true;
  observer.disconnect();
});
observer.observe(document.getElementById('root')!, { childList: true, subtree: true });
void (async () => {
  try {
    await import('../site/main');
    await import('../popout-demo/tray.css');
  } catch {
    observer.disconnect();
    message.hidden = false;
    message.setAttribute('role', 'alert');
    message.textContent = 'The tray could not load. Reload to try again.';
  }
})();
