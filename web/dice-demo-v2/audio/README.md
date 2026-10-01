# Recorded dice clacks

Source: **Dice Roll Sound Effects** by **Gliz Caldo**,
https://www.youtube.com/watch?v=F4Kxnv3Hzmk.

The creator's video description, checked 2026-10-01, permits use:
“Feel free to use these sounds, you do not have to credit me.”
The owner's supplied screen recording is the extraction source. These audio
assets retain the creator's rights and permission; the application's MIT license
does not claim ownership of the recording. No Owlbear Rodeo recording is used.

Four isolated initial contacts were cut from the supplied recording, rather than
using entire roll sequences. All are mono 48 kHz / 16-bit PCM WAV. Each has a
0.25 ms entrance fade, 6 ms exit fade and peak normalization to 0.9; a tiny DC
offset is removed. Decoded playback also preserves the 0.9 peak ceiling after
browser resampling. No synthesis or tonal filtering is applied.

| Clip | Recording start | Recording end | Length |
| --- | ---: | ---: | ---: |
| clack-1.wav | 3.433229 s | 3.535 s | 101.77 ms |
| clack-2.wav | 6.230625 s | 6.300 s | 69.38 ms |
| clack-3.wav | 9.135729 s | 9.250 s | 114.27 ms |
| clack-4.wav | 13.412750 s | 13.475 s | 62.25 ms |

The original video and full uploaded screen recording are not distributed.

# Result cues

`crit-sword-draw.wav` is **Sword Draw Sound Effect** by **CPhT Fluke**:
https://www.youtube.com/watch?v=BQV5rbBMjCQ. The owner selected this exact clip
and explicitly requested production use on 2026-10-01 after auditioning it.
The creator's description identifies its use in the student game *Iron* but
does not state a reuse license. The recording retains the creator's rights;
it is not covered by the application's MIT license. It is converted to mono
48 kHz / 16-bit PCM without changing timing or pitch (0.768 seconds).

`crit-fail.wav` is the application's original synthesized dark impact and
descending metallic groan, approved in the same audition. It is rendered from
`web/site/cinematic-critical-cue.ts` at 48 kHz / 16-bit PCM (1.3 seconds) and
is covered by the application's MIT license. Its peak is 0.78.

Both cues use the existing result-reveal timing, volume gain and sound preference.
They are loaded only when sounds are enabled, and never replayed from history.
