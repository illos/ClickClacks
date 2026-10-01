# Dice sound references

## Current recorded sound

The owner supplied a screen recording of [Dice Roll Sound Effects by Gliz Caldo](https://www.youtube.com/watch?v=F4Kxnv3Hzmk)
and requested direct clips or synthesis, whichever was easier. Playback now uses
four isolated recorded landing contacts. The source description permits using
the sounds without credit; provenance, cut times and processing are recorded in
`web/dice-demo-v2/audio/README.md`. Previous synthesized sounds below are history.

Encoded WAV bytes are cached, with separate decoded buffers per AudioContext.
Decoding copies the bytes because browsers can detach decode inputs; returning
from a Safari tab can therefore rebuild the context without empty audio data.
The existing physics impact times, volume/pool attenuation, saved sound toggle,
mute cancellation and iOS Safari session recovery remain. No full recorded roll
is layered over each bounce. Source audio is used without a tonal filter.

## Earlier wood impact reference

Owner requested waveform analysis of Owlbear Rodeo's dice audio, then chose wood
only for this pass. Dice-on-dice mixing remains a later option.

Reference: [owlbear-rodeo/dice](https://github.com/owlbear-rodeo/dice/tree/ccc32beceee0888c0a48129fbb23f4a636c710ee),
commit `ccc32beceee0888c0a48129fbb23f4a636c710ee`.
Its [audio loader](https://github.com/owlbear-rodeo/dice/blob/ccc32beceee0888c0a48129fbb23f4a636c710ee/src/audio/getAudioBuffer.ts)
cycles four recordings per weight/material.
[Tray collisions](https://github.com/owlbear-rodeo/dice/blob/ccc32beceee0888c0a48129fbb23f4a636c710ee/src/colliders/TrayColliders.tsx)
use leather for the floor and wood for walls; separate clips cover dice collisions.
The project is GPLv3. Its recordings and implementation are not copied into
Power Roller: this uses measured characteristics to guide independently written
synthesis.

## Measurements

Decoded all 36 light/medium/heavy wood/leather/dice clips with Chromium's
OfflineAudioContext at 48 kHz, averaged channels to mono, then measured energy
and spectra with NumPy. Wood has strong resonances around 650, 1200, 2100 and
3400 Hz; dice-on-dice clips have much more extreme treble. Some recordings contain
multiple contacts, so they do not all share one envelope.

For the representative single wood impacts below, the start is the first 1 ms
RMS envelope crossing 10% of its maximum. Times are cumulative squared-sample
energy after that start. Spectral centroid uses FFT power weighting over the
remaining clip. Values are our measurements, not upstream claims. Generated
variants contain independent grain, so their measurements vary slightly.

| Measurement | Medium wood 01 | Heavy wood 01 | New synthetic variant 1 |
| --- | ---: | ---: | ---: |
| 50% energy | 3.21 ms | 5.21 ms | ~3.17 ms |
| 90% energy | 9.29 ms | 16.48 ms | ~9.65 ms |
| 95% energy | 12.50 ms | 31.81 ms | ~13.15 ms |
| Spectral centroid | 1442 Hz | 1005 Hz | ~1438 Hz |
| Energy at 300–1000 Hz | 57.9% | 71.7% | ~56.5% |
| Energy at 1–3 kHz | 22.2% | 23.4% | ~21.3% |
| Energy at 3–6 kHz | 19.5% | 1.8% | ~20.3% |

Representative files:
[medium wood 01](https://github.com/owlbear-rodeo/dice/blob/ccc32beceee0888c0a48129fbb23f4a636c710ee/src/audio/medium/wood/01.mp3),
[heavy wood 01](https://github.com/owlbear-rodeo/dice/blob/ccc32beceee0888c0a48129fbb23f4a636c710ee/src/audio/heavy/wood/01.mp3).

## Implementation

`web/dice-demo-v2/wood-clack.ts` generates four variants with a fast attack,
damped inharmonic wood resonances, very little broadband strike noise, and a
quiet grain tail. Each source peaks at 0.9, with the existing impact-volume/pool
attenuation retained. A mild lowpass and narrow pitch variation are applied at
playback. The sound is still generated, not the upstream recording. Matching
energy and frequency balance helps tuning but does not prove perceptual identity.
Actual iPhone listening remains the acceptance check for sound character.

## Dice-on-dice pass

Owner subsequently requested dice-on-dice instead of wood. Current playback
therefore uses `dice-clack.ts` alone; combining contact types is still deferred.
The wood generator stays available as source for that later option.

Measurements of the medium dice-collision clips show an initial sub-millisecond
strike, a second contact roughly 8–12 ms later, very little midrange ringing,
and a spectral center around 5.6–6.7 kHz. Most spectral energy is above 3 kHz.
The independent synthesis now uses very short 5.1/7.35/9.3 kHz resonances, a
smaller second strike, and a quiet low-frequency residual. The playback lowpass
moves to 11 kHz to preserve the measured treble balance. Four variations remain;
no recording or source waveform is copied.

Using the same onset/energy/FFT method above:

| Measurement | Medium dice 01 | Medium dice 02 | New synthetic variant 1 |
| --- | ---: | ---: | ---: |
| 90% energy | 12.23 ms | 8.94 ms | ~8.54 ms |
| 95% energy | 12.25 ms | 8.98 ms | ~8.62 ms |
| Spectral centroid | 6152 Hz | 6471 Hz | ~6398 Hz |
| Energy at 3–6 kHz | 36.3% | 28.7% | ~27.2% |
| Energy above 6 kHz | 58.2% | 65.7% | ~62.1% |

Reference files:
[medium dice 01](https://github.com/owlbear-rodeo/dice/blob/ccc32beceee0888c0a48129fbb23f4a636c710ee/src/audio/medium/dice/01.mp3),
[medium dice 02](https://github.com/owlbear-rodeo/dice/blob/ccc32beceee0888c0a48129fbb23f4a636c710ee/src/audio/medium/dice/02.mp3).
