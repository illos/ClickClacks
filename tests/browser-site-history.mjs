// SPDX-License-Identifier: MIT
// Coordinator-only, isolated IndexedDB regression. No application/backend traffic.
import { chromium } from '@playwright/test';
import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const compile = file => ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const deadlineUrl = dataUrl(compile('../web/dice-demo-v2/history-deadline.ts'));
const moduleUrl = dataUrl(compile('../web/site/storage.ts').replace('../dice-demo-v2/history-deadline', deadlineUrl));
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  await context.route('http://history.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>History fixture</title>' }));
  const first = await context.newPage(), second = await context.newPage();
  await Promise.all([first.goto('http://history.test/'), second.goto('http://history.test/')]);
  await first.evaluate(async () => {
    const request = indexedDB.open('powerroller.history.v2', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('rolls', { keyPath: 'key' });
    const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const style = { color: '#ffffff', ink: '#000000', pattern: 'solid' };
    await new Promise((resolve, reject) => {
      const tx = db.transaction('rolls', 'readwrite');
      for (const [id, age] of [['live', 1000], ['expired', 3600001]]) {
        const roll = { id, roller: 'viewer', name: 'Fixture', startsAt: Date.now() - age, duration: 1000, faces: [3], styles: [style], motion: { seed: 1, stepMs: 16, samples: [], offsets: [] } };
        tx.objectStore('rolls').put({ key: JSON.stringify(['fixture', 'room', 'viewer', id]), backend: 'fixture', room: 'room', savedAt: Date.now(), roll });
      }
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  const migrated = await first.evaluate(async moduleUrl => (await import(moduleUrl)).loadHistory('fixture', 'room'), moduleUrl);
  assert.deepEqual(migrated.map(roll => roll.id), ['live']);
  // Independent module instances exercise the browser's cross-window transaction ordering.
  const save = (page, prefix) => page.evaluate(async ({ moduleUrl, prefix }) => {
    const api = await import(moduleUrl), style = { color: '#ffffff', ink: '#000000', pattern: 'solid' };
    await Promise.all(Array.from({ length: 12 }, (_, i) => api.cacheRoll('fixture', 'room', {
      id: `${prefix}-${i}`, roller: 'viewer', name: 'Fixture', startsAt: Date.now(), duration: 1000,
      faces: [i + 1], styles: [style], motion: { seed: 1, stepMs: 16, samples: [], offsets: [] },
    })));
  }, { moduleUrl, prefix });
  await Promise.all([save(first, 'first'), save(second, 'second')]);
  const result = await first.evaluate(async moduleUrl => {
    const api = await import(moduleUrl);
    const getAll = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll = () => { throw Error('Global scans are forbidden'); };
    try {
      const history = await api.loadHistory('fixture', 'room');
      return { count: history.length, compact: history.filter(row => row.id !== 'live').every(row => !('motion' in row)) };
    } finally { IDBObjectStore.prototype.getAll = getAll; }
  }, moduleUrl);
  assert.equal(result.count, 25); assert.equal(result.compact, true);
  await context.close();
  console.log(JSON.stringify({ migration: 'PASS', concurrentWindows: 'PASS', indexedReads: 'PASS', result }));
} finally { await browser.close(); }
