// SPDX-License-Identifier: MIT
import { afterEach, expect, it, vi } from 'vitest';
import { acquireIosAudioSession, isIosSafari } from '../web/dice-demo-v2/ios-audio-session';
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('limits the workaround to iOS Safari, including desktop-mode iPad', () => {
  expect(isIosSafari(iphone,5)).toBe(true);
  expect(isIosSafari('Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18 Safari/605.1.15',5)).toBe(true);
  expect(isIosSafari('Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18 Safari/605.1.15',0)).toBe(false);
  expect(isIosSafari(iphone.replace('Version/18.0','CriOS/130.0'),5)).toBe(false);
  expect(isIosSafari(iphone.replace('Version/18.0','FxiOS/130.0'),5)).toBe(false);
  expect(isIosSafari('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130 Safari/537.36',0)).toBe(false);
  expect(isIosSafari('Mozilla/5.0 (Macintosh) Gecko/20100101 Firefox/130.0',0)).toBe(false);
});
it('cycles the iOS session category and restores it when released', () => {
  vi.useFakeTimers(); const session={type:'auto'};
  vi.stubGlobal('navigator',{userAgent:iphone,maxTouchPoints:5,audioSession:session});
  const release=acquireIosAudioSession();expect(session.type).toBe('ambient');
  vi.runAllTimers();expect(session.type).toBe('playback');release();expect(session.type).toBe('auto');
});
it('does not change desktop audio or acquire a session after background cancellation', () => {
  vi.useFakeTimers();const session={type:'auto'};
  vi.stubGlobal('navigator',{userAgent:'Mozilla/5.0 (Macintosh) AppleWebKit/605 Safari/605',maxTouchPoints:0,audioSession:session});
  acquireIosAudioSession()();vi.runAllTimers();expect(session.type).toBe('auto');
  vi.stubGlobal('navigator',{userAgent:iphone,maxTouchPoints:5,audioSession:session});
  acquireIosAudioSession()();vi.runAllTimers();expect(session.type).toBe('auto');
});
it('preserves a host session already used for recording',()=>{
 const session={type:'play-and-record'};vi.stubGlobal('navigator',{userAgent:iphone,maxTouchPoints:5,audioSession:session});
 acquireIosAudioSession()();expect(session.type).toBe('play-and-record');
});
