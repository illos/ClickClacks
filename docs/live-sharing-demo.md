# Live sharing demonstration

The owner replaced the recording with a non-interactive instance of the real
Click Clacks app. The square iframe runs at 720 × 720 and scales to its website
column, to the left of the section copy (above it on narrow screens). It uses the existing component, renderer, roll lifecycle and dedicated
Powerroller backend. Each page load has an isolated table and two fresh identities.

The repeating sequence is Alex rolling 1d12, opening Sharing, copying the code,
holding the menu for three seconds, closing it, then Sam joining and rolling
2d4. The result remains visible briefly. Sam leaves, the tray clears, and the
visible log resets before the next cycle. One table is reused across cycles;
the host's presentation boundary hides older accepted history without deleting
backend records. Ordinary app consumers retain their existing full log.

The iframe is inert, skipped by keyboard navigation, hidden from assistive
technology, and ignores pointers. Trusted input is also blocked in its document.
The website supplies a text description. A host clipboard adapter lets the real
copy handler show confirmation without altering visitors' clipboards. The normal
app keeps its browser clipboard implementation.

The iframe loads only when visible. Its script and app subscriptions stop when
offscreen or when the page is hidden; Sam's in-flight work settles before his
controller leaves and disposes. The sequence restarts when visible again. Audio
is explicitly muted. Unavailable backend connections show a reconnecting notice.

The old recordings remain in GitHub releases as historical authored assets.
The landing build no longer downloads or publishes video files. The previous
autoplay-video integration checks are superseded by this implementation. The
owner's live-before-checks request remains in effect; browser verification is
held for owner viewing. Publication details will be recorded after deployment.
