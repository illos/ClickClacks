// SPDX-License-Identifier: MIT
import { expect, it } from 'vitest';
import { canonicalPage } from '../worker/canonical';

it('redirects legacy and insecure navigation while preserving room and tray options', () => {
  for (const method of ['GET', 'HEAD']) {
    const response = canonicalPage(new Request('http://app.clickclacks.app/web/popout/tray.html?room=ABCD&theme=light', { method }));
    expect(response?.status).toBe(308);
    expect(response?.headers.get('location')).toBe('https://dice.clickclacks.app/web/popout/tray.html?room=ABCD&theme=light');
  }
  expect(canonicalPage(new Request('http://dice.clickclacks.app/?room=ABCD'))?.headers.get('location'))
    .toBe('https://dice.clickclacks.app/?room=ABCD');
});

it('consolidates duplicate entry URLs without redirecting canonical pages or local previews', () => {
  for (const url of ['https://clickclacks.app/index.html', 'https://clickclacks.app/landing.html']) {
    expect(canonicalPage(new Request(url))?.headers.get('location')).toBe('https://clickclacks.app/');
  }
  expect(canonicalPage(new Request('https://dice.clickclacks.app/index.html?room=ABCD'))?.headers.get('location'))
    .toBe('https://dice.clickclacks.app/?room=ABCD');
  for (const url of ['https://clickclacks.app/', 'https://dice.clickclacks.app/', 'http://localhost:9591/index.html']) {
    expect(canonicalPage(new Request(url))).toBeUndefined();
  }
});

it('keeps legacy same-origin reporting endpoints and non-navigation requests intact', () => {
  for (const method of ['GET', 'POST', 'OPTIONS']) {
    expect(canonicalPage(new Request('https://app.clickclacks.app/api/bug-reports', { method }))).toBeUndefined();
  }
  expect(canonicalPage(new Request('https://app.clickclacks.app/', { method: 'POST' }))).toBeUndefined();
});
