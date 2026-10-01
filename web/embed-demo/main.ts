// SPDX-License-Identifier: MIT
import { parseRoomKey } from 'powerroller/client';
import './page.css';

const frame = document.querySelector<HTMLIFrameElement>('#tray')!;
const room = document.querySelector<HTMLInputElement>('#room')!;
const snippet = document.querySelector<HTMLTextAreaElement>('#snippet')!;
const roomStatus = document.querySelector<HTMLParagraphElement>('#room-status')!;
const copyStatus = document.querySelector<HTMLParagraphElement>('#copy-status')!;

function update() {
  const key = room.value.trim() ? parseRoomKey(room.value.trim()) : null;
  if (room.value.trim() && !key) {
    roomStatus.textContent = 'Enter a valid room code or Power Roller invite link.';
    room.setAttribute('aria-invalid', 'true');
    return;
  }
  room.removeAttribute('aria-invalid');
  const url = new URL('../../embed/index.html', location.href);
  if (key) url.searchParams.set('room', key);
  frame.src = url.href;
  // The URL is generated from this page's origin and a validated room identifier.
  snippet.value = `<iframe\n  src="${url.href}"\n  title="Power Roller dice tray"\n  width="480"\n  height="420"\n  loading="lazy"\n  style="max-width:100%;border:0;border-radius:16px"\n></iframe>`;
  roomStatus.textContent = key ? 'Embedded rollers will join this shared room.' : 'Leave empty for a personal tray.';
  copyStatus.textContent = '';
}
document.querySelector('#embed-options')!.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
document.querySelector('#copy')!.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(snippet.value);
    copyStatus.textContent = 'Embed code copied.';
  } catch {
    snippet.focus();
    snippet.select();
    copyStatus.textContent = 'Select and copy the embed code above.';
  }
});
update();
