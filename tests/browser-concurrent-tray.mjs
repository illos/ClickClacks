// SPDX-License-Identifier: MIT
import { chromium, expect } from '@playwright/test';

// Display fixtures use the original planner/renderer, without submitting supplied
// faces to the backend. A longer playback clock makes the overlap deterministic.
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.URL || 'http://127.0.0.1:9594/powerroller/');
  await expect(page.getByRole('button', { name: 'Roll', exact: true })).toBeEnabled({ timeout: 30000 });
  await page.evaluate(async () => {
    const { createRoomTray } = await import('/powerroller/web/dice-demo-v2/renderer.ts');
    const { createThrowPlanner } = await import('/powerroller/web/dice-demo/prepare-throw.ts');
    const { loadDiceFonts } = await import('/powerroller/web/dice-demo/fonts.ts');
    await loadDiceFonts();
    const overlay = document.createElement('div');
    overlay.className = 'powerroller';
    overlay.innerHTML = '<section class="stage" style="position:fixed;top:140px;left:25px;width:380px;height:330px;z-index:20;border:1px solid #354043;border-radius:20px;background:#151a1b"><div class="canvas-host" style="height:100%"></div></section>';
    document.body.appendChild(overlay);
    const host = overlay.querySelector('.canvas-host');
    const style = { color: '#70dac3', ink: '#111415', pattern: 'solid', font: 'serif' };
    window.concurrentReveals = [];
    window.concurrentTray = createRoomTray(host, () => { throw Error('Fixture WebGL failed'); },
      (roll, timing) => window.concurrentReveals.push({ id: roll.id, frames: timing.frames }));
    const planner = createThrowPlanner();
    const paths = [];
    for (let index = 0; index < 3; index++) {
      const prepared = (await planner.prepareThrow([3, 9], { scale: .65, obstacles: [] })).motion;
      const steps = prepared.samples.length / 14 - 1;
      const motion = { ...prepared, stepMs: Math.max(prepared.stepMs, 3200 / steps) };
      paths.push({ motion, duration: steps * motion.stepMs });
    }
    planner.dispose();
    const member = (id, slot) => ({ id, name: id, slot, ready: true, uncertainty: 0, seenAt: Date.now(), style });
    window.concurrentMembers = [member('owner', 0), member('peer', 1)];
    window.concurrentRoll = (id, roller) => {
      const startsAt = performance.now() + 30;
      const { motion, duration } = paths[id === 'first' ? 0 : id === 'third' ? 2 : 1];
      return { id, roller, name: roller, faces: [3, 9], styles: [style, style], startsAt,
        duration, revealAt: startsAt + duration, motion };
    };
    window.concurrentFirst = window.concurrentRoll('first', 'owner');
    window.concurrentTray.play(window.concurrentFirst, { offset: 0, uncertainty: 0 });
    // Two same-owner throws received before presence must both be queued.
    window.concurrentSecond = window.concurrentRoll('queued-second', 'owner');
    window.concurrentTray.play(window.concurrentSecond, { offset: 0, uncertainty: 0 });
    window.concurrentTray.participants(window.concurrentMembers);
  });
  const stage = page.locator('.stage').last();
  await expect(stage.locator('.tray-roll-result[data-roller="owner"]')).toHaveCount(2);
  // Replace just the queued test throw, leaving first running to the follow-up tap.
  await page.evaluate(() => {
    window.concurrentTray.clear('owner');
    window.concurrentFirst = window.concurrentRoll('first', 'owner');
    window.concurrentTray.play(window.concurrentFirst, { offset: 0, uncertainty: 0 });
  });
  await page.waitForTimeout(2000);
  expect(await page.evaluate(() => window.concurrentReveals)).toEqual([]);
  await page.evaluate(() => {
    window.concurrentSecond = window.concurrentRoll('second', 'owner');
    window.concurrentPeer = window.concurrentRoll('third', 'peer');
    window.concurrentTray.play(window.concurrentSecond, { offset: 0, uncertainty: 0 });
    window.concurrentTray.play(window.concurrentPeer, { offset: 0, uncertainty: 0 });
    // A server refresh of an existing ID updates its clock instead of recreating it.
    window.concurrentTray.play(window.concurrentFirst, { offset: 2, uncertainty: 4 });
    window.concurrentTray.play({ ...window.concurrentSecond, id: 'logical-only', motion: undefined },
      { offset: 0, uncertainty: 0 });
  });
  await expect(stage.locator('.tray-roll-result')).toHaveCount(3);
  await expect(stage.locator('.tray-roll-result[data-roll-id="first"]')).toHaveCount(1);
  await expect(stage.locator('.tray-roll-result[data-roll-id="second"]')).toHaveCount(1);
  await expect(stage.locator('.tray-roll-result[data-roll-id="third"]')).toHaveCount(1);
  await page.waitForTimeout(650);
  await page.screenshot({ path: '/tmp/powerroller-concurrent-tray.png' });
  await expect.poll(() => page.evaluate(() => window.concurrentReveals.length), { timeout: 8000 }).toBe(3);
  expect(await page.evaluate(() => window.concurrentReveals.map(value => value.id).sort())).toEqual(['first', 'second', 'third']);
  expect(await page.evaluate(() => window.concurrentReveals.every(value => value.frames > 20))).toBe(true);
  await page.evaluate(() => {
    const recolored = window.concurrentMembers.map(member => ({ ...member, style: { ...member.style, color: '#ff8f96' } }));
    window.concurrentTray.participants(recolored);
    window.concurrentTray.clear('owner');
  });
  await expect(stage.locator('.tray-roll-result[data-roller="owner"]')).toHaveCount(0);
  await expect(stage.locator('.tray-roll-result[data-roller="peer"]')).toHaveCount(1);
  // The original five-second hold + 600ms fade removes settled mesh/material/DOM lanes.
  await expect(stage.locator('.tray-roll-result')).toHaveCount(0, { timeout: 8000 });
  await page.evaluate(() => window.concurrentTray.play(window.concurrentPeer, { offset: 0, uncertainty: 0 }));
  await expect(stage.locator('.tray-roll-result')).toHaveCount(0);
  await page.evaluate(() => {
    window.concurrentTray.play(window.concurrentRoll('removed-one', 'owner'), { offset: 0, uncertainty: 0 });
    window.concurrentTray.play(window.concurrentRoll('removed-two', 'owner'), { offset: 0, uncertainty: 0 });
  });
  await expect(stage.locator('.tray-roll-result[data-roller="owner"]')).toHaveCount(2);
  await page.evaluate(() => window.concurrentTray.participants(window.concurrentMembers.filter(member => member.id !== 'owner')));
  await expect(stage.locator('.tray-roll-result[data-roller="owner"]')).toHaveCount(0);
  await page.evaluate(() => window.concurrentTray.dispose());
  await expect(stage.locator('canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log('PASS: two same-owner queued throws; follow-up at two seconds keeps first + peer tracks; all three animate and reveal once; duplicate/logical-only updates preserve lanes; owner clear and presence removal clear every owner lane; normal expiry removes lanes and old refresh cannot resurrect them; no page errors.');
} finally {
  await browser.close();
}
