// SPDX-License-Identifier: MIT
import { build } from 'vite';
// Both documents share one asset graph, including the lazy renderer and worker.
await build({configFile:'vite.config.ts'});
