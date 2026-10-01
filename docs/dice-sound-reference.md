# Wood impact reference

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
