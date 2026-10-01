// SPDX-License-Identifier: MIT
import { build } from 'vite';

// Independent entry graphs keep the site's React startup out of auxiliary pages.
await build({configFile:'vite.config.ts'});
await build({configFile:'web/popout/vite.config.ts'});
