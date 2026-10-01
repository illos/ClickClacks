# Private crit sound demo

Build and serve independently of the production site:

```sh
pnpm exec vite build --config examples/critical-sounds/vite.config.ts
pnpm exec vite preview --config examples/critical-sounds/vite.config.ts
```

The page is `/web/site/critical-sounds.html`. Preview binds to loopback port 9601;
expose it through a dedicated Tailscale Serve endpoint for private listening.
The normal site build does not include this entry or its generated files.

The current crit audition uses the exact user-selected [Sword Draw Sound Effect
by CPhT Fluke](https://www.youtube.com/watch?v=BQV5rbBMjCQ), converted to mono
48 kHz PCM WAV without changing its timing or pitch. Place the recording at
`.preview/critical-sounds/assets/crit-sword-draw.wav` after building. The recording
is kept outside Git and the public site; the source description does not state
reuse terms. The demo credits and links the creator.

The crit fail remains the original synthesized low impact and descending dissonant
resonance in `web/site/cinematic-critical-cue.ts`. Both are injected only by this
demo. The live site's existing result accents and recorded landing clacks remain
unchanged while these sounds are being auditioned.
