// SPDX-License-Identifier: MIT
import { createRoomTray } from '../dice-demo-v2/renderer';
import { createThrowPlanner } from '../dice-demo/prepare-throw';
import { loadDiceFonts } from '../dice-demo/fonts';
import { createDiceSound } from '../dice-demo-v2/dice-sound';
import { loadRecordedCriticalCue } from './recorded-critical-cue';
import { criticalLabel, criticalResult } from '../../lib/critical';
import { loadProfile } from './storage';
import type { ParticipantRoll } from '../dice-demo-v2/model';
import '../../lib/styles.css';
import './critical-sounds.css';

type Mode = 'success' | 'failure' | 'alternate';
const rollButton = document.querySelector<HTMLButtonElement>('#demo-roll')!;
const soundButton = document.querySelector<HTMLButtonElement>('#demo-sound')!;
const status = document.querySelector<HTMLElement>('#demo-status')!;
const host = document.querySelector<HTMLElement>('.canvas-host')!;
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-mode]')];
document.querySelector<HTMLAnchorElement>('.demo-header a')!.href = import.meta.env.BASE_URL;
const volume = document.querySelector<HTMLInputElement>('#demo-volume')!;
const volumeValue = document.querySelector<HTMLOutputElement>('#demo-volume-value')!;
const style = loadProfile()?.style ?? { color: '#70dac3', ink: '#111415', pattern: 'solid', font: 'serif' };
const dice = { kind: 'power', sides: 10, count: 2 } as const;
const planner = createThrowPlanner();
let recordedCue: Awaited<ReturnType<typeof loadRecordedCriticalCue>>;
const audio = createDiceSound((sampleRate, result) => recordedCue(sampleRate, result));
let tray: ReturnType<typeof createRoomTray> | undefined;
let mode: Mode = 'alternate', alternateSuccess = true, soundEnabled = true;
let ready = false, preparing = false, unavailableUntil = 0, disposed = false;
let cooldown: ReturnType<typeof setTimeout> | undefined;
audio.setEnabled(true);
volume.addEventListener('input', () => {
  audio.setCriticalVolume(Number(volume.value) / 100);
  volumeValue.value = `${volume.value}%`;
});

function updateRollButton() {
  rollButton.disabled = !ready || preparing || performance.now() < unavailableUntil;
}
function explain(roll: ParticipantRoll) {
  status.textContent = `${criticalLabel(criticalResult(roll)!)} · 2d10 | ${roll.faces.join(' + ')} = ${roll.total}`;
}
for (const button of modeButtons) button.addEventListener('click', () => {
  mode = button.dataset.mode as Mode;
  for (const item of modeButtons) item.setAttribute('aria-pressed', String(item === button));
});
soundButton.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  audio.setEnabled(soundEnabled);
  soundButton.setAttribute('aria-pressed', String(soundEnabled));
  soundButton.textContent = soundEnabled ? 'Sound on' : 'Sound off';
  if (soundEnabled) void audio.unlock();
});
rollButton.addEventListener('click', async () => {
  if (!ready || preparing || performance.now() < unavailableUntil) return;
  // Start audio activation on this tap, before any asynchronous planning.
  const unlocked = audio.unlock();
  preparing = true;
  unavailableUntil = performance.now() + 2000;
  updateRollButton();
  clearTimeout(cooldown);
  cooldown = setTimeout(updateRollButton, 2005);
  const success = mode === 'alternate' ? alternateSuccess : mode === 'success';
  if (mode === 'alternate') alternateSuccess = !alternateSuccess;
  const faces = success ? [9, 10] : [1, 1];
  status.textContent = 'Rolling…';
  try {
    const [{ motion }] = await Promise.all([planner.prepareThrow(faces, { scale: .65, obstacles: [], dice }), unlocked]);
    if (disposed || !tray) return;
    const duration = (motion.samples.length / (faces.length * 7) - 1) * motion.stepMs;
    const total = faces[0]! + faces[1]!;
    const roll: ParticipantRoll = {
      id: crypto.randomUUID(), roller: 'sound-demo', name: 'Sound demo', faces, dice,
      styles: [style, style], startsAt: performance.now() + 150, duration, motion, total,
      power: { edges: 0, banes: 0, total, tier: success ? 3 : 1 },
    };
    tray.play(roll, { offset: 0, uncertainty: 0 });
    audio.play(roll, 0, matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch {
    status.textContent = 'Could not prepare that roll. Try again.';
  } finally {
    preparing = false;
    updateRollButton();
  }
});

void Promise.all([
  loadDiceFonts(), planner.warmThrows({ scale: .65, obstacles: [], dice }),
  loadRecordedCriticalCue().then(cue => { recordedCue = cue; }),
]).then(() => {
  if (disposed) return;
  tray = createRoomTray(host, () => {
    ready = false; updateRollButton(); status.textContent = 'The dice tray needs a reload.';
  }, explain);
  tray.participants([{ id: 'sound-demo', name: 'Sound demo', slot: 0, ready: true, uncertainty: 0, seenAt: Date.now(), style }]);
  ready = true;
  status.textContent = 'Tap Roll to hear the crit sound.';
  updateRollButton();
}).catch(() => { status.textContent = 'Could not load the dice. Reload to try again.'; });

addEventListener('pagehide', event => {
  if (event.persisted) return;
  disposed = true; clearTimeout(cooldown);
  audio.dispose(); planner.dispose(); tray?.dispose();
});
