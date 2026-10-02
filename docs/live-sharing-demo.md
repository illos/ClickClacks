# Live sharing demonstration

The owner replaced the recording with a non-interactive instance of the real
Click Clacks app. The square iframe runs at 720 × 720 and scales to its website
column, to the left of the section copy (above it on narrow screens). It uses the existing component, renderer, roll lifecycle and dedicated
Powerroller backend. Each page load has an isolated table and two fresh identities.

The repeating sequence is Ariadne rolling 1d12, waiting a beat, opening Sharing
with a tap ripple, copying the code, and closing the menu after three seconds.
An example chat card then types Ariadne's invitation, pastes the actual table code,
and shows the message being sent. Cato types and replies ‘Got it, joining now!’
before the card closes and he joins the actual table and rolls 2d4. Sharing opens
1200ms after Ariadne's result is observed, including the final 300ms tap indicator.
The menu holds for 1200ms before copying and three seconds after confirmation.
Chat typing uses 70ms per character; the pasted code holds for 1400ms, followed
by a 300ms send press, a 1400ms sent hold, 1400ms of Cato typing and a 2200ms reply hold.
The chat is a local illustration and does not contact Discord or send any external message.
The script waits for the real `.join-log-entry[data-participant]` row for Cato,
then holds it for 900ms before requesting his roll. Join notices use the same
`historySince` boundary as rolls, so each repeat starts with an empty log.
Both the interactive hero and the sharing illustration use Ariadne and Cato.
The result remains visible briefly. Cato leaves, the tray clears, and the
visible log resets before the next cycle. One table is reused across cycles;
the host's presentation boundary hides older accepted history without deleting
backend records. Ordinary app consumers retain their existing full log.

The iframe is inert, skipped by keyboard navigation, hidden from assistive
technology, and ignores pointers. Trusted input is also blocked in its document.
The website supplies a text description. A host clipboard adapter lets the real
copy handler show confirmation without altering visitors' clipboards. The normal
app keeps its browser clipboard implementation.

The iframe loads only when visible. Its script and app subscriptions stop when
offscreen or when the page is hidden; Cato's in-flight work settles before his
controller leaves and disposes. The sequence restarts when visible again. Audio
is explicitly muted. Unavailable backend connections show a reconnecting notice.

The old recordings remain in GitHub releases as historical authored assets.
The landing build no longer downloads or publishes video files. The previous
autoplay-video integration checks are superseded by this implementation. The
owner's live-before-checks request remains in effect; browser verification is
held for owner viewing. Authoring typecheck passed. Source review accepted
`c4f31dc`; layout follow-up `887f634` moves the demo left and text right. Neither
the former video checks nor source review is claimed as browser verification of
the new live sequence.

Source `8a0bebd` (including the latest main documentation) was merged into main
and pushed, then published to `https://clickclacks.app/` on 2026-10-02. The required
landing build and Wrangler 4.134.0 deployment exited 0. Landing Worker version:
`a91f509f-b536-4401-9ac2-910d2cd35fd1`. The app Worker remains the independently
published automatic-session version `47f8ca1d-7efe-41c8-8475-6cbc22753a66`.
Publication logs are outside Git at
`/srv/presidium/home/projects/powerroller/test-artifacts/sharing-live-publication-8a0bebd/`.

The tap/chat revision `9a90d94` passed authoring typecheck and source review.
It was merged into main, pushed, and published on 2026-10-02. Required landing
build and Wrangler 4.134.0 deployment exited 0; landing Worker version is
`5ad355ec-16c4-477e-97fb-f44160df0859`. Browser timing/layout checks remain held
for owner viewing. Revision logs:
`/srv/presidium/home/projects/powerroller/test-artifacts/sharing-chat-publication-9a90d94/`.
