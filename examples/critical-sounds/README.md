# Private crit sound demo

Build and serve independently of the production site:

```sh
pnpm exec vite build --config examples/critical-sounds/vite.config.ts
pnpm exec vite preview --config examples/critical-sounds/vite.config.ts
```

The page is `/web/site/critical-sounds.html`. Preview binds to loopback port 9601;
expose it through a dedicated Tailscale Serve endpoint for private listening.
The normal site build does not include this entry or its generated files.

The owner approved both audition sounds for production on 2026-10-01. This demo
now uses the same audio loader, result WAVs, reveal timing and volume as the live
site: CPhT Fluke's selected sword draw and the application's original dark impact
and descending metallic groan. See `web/dice-demo-v2/audio/README.md` for provenance.
The demo itself remains private and does not join tables or write preferences.
