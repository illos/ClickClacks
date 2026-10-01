// SPDX-License-Identifier: MIT
/** Platform-scoped workaround for WebKit's stale tab audio-session category.
 * https://bugs.webkit.org/show_bug.cgi?id=323104
 * Playback can pause other device audio; explicitly enabled by the owner on iOS Safari only. */
export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return ios && /AppleWebKit/.test(userAgent) && /Safari/.test(userAgent)
    && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
}

type Session = { type: string };
export function acquireIosAudioSession(): () => void {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const session = (nav as (Navigator & { audioSession?: Session }) | undefined)?.audioSession;
  if (!nav || !session || !isIosSafari(nav.userAgent, nav.maxTouchPoints)) return () => {};
  const previous = session.type;
  // An embedding host may already own a microphone or other session category.
  if (!['auto', 'ambient', 'playback'].includes(previous)) return () => {};
  let active = true, timer: ReturnType<typeof setTimeout> | undefined;
  try {
    session.type = 'ambient';
    // A genuinely different category forces WebKit to update its audio process.
    timer = setTimeout(() => {
      if (!active) return;
      try { session.type = 'playback'; } catch {}
    }, 0);
  } catch {}
  return () => {
    active = false; clearTimeout(timer);
    try { if (['ambient','playback'].includes(session.type)) session.type = previous; } catch {}
  };
}
