# Private crit sound demo

Build and serve independently of the production site:

```sh
pnpm exec vite build --config examples/critical-sounds/vite.config.ts
pnpm exec vite preview --config examples/critical-sounds/vite.config.ts
```

The page is `/web/site/critical-sounds.html`. Preview binds to loopback port 9601;
expose it through a dedicated Tailscale Serve endpoint for private listening.
The normal site build does not include this entry or its generated files.
