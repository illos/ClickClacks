# Three 0.186.1 renderer lookup ownership

`three@0.186.1.patch` changes the source renderer and the package's exported ESM
renderer build. The CommonJS build contains core types, without WebGLRenderer.

Upstream's module-scoped `DFG_LUT` DataTexture acquires a per-renderer texture
dispose listener. `WebGLRenderer.dispose()` does not remove that listener, retaining
retired texture managers and WebGL contexts through the global lookup. The pinned
patch lazily clones the texture wrapper for each renderer, sharing the exact
immutable lookup pixels and texture settings. Each renderer disposes its own
wrapper before resetting its properties. Other mounted renderers keep their own
lookup wrappers and GPU allocations.

The frontend investigation documents the unpatched heap retainer path. Browser
lifecycle profiling must confirm the patched preview/remount plateau and that an
open tray continues rendering while another renderer closes. Review this patch
when changing Three's version; do not silently carry it to a different release.
