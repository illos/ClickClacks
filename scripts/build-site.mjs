// SPDX-License-Identifier: MIT
import { build } from 'vite';
import { mkdir, copyFile } from 'node:fs/promises';
// Both documents share one asset graph, including the lazy renderer and worker.
await build({configFile:'vite.config.ts'});

// Retain the previous public tray URL without building a second asset graph.
await mkdir('dist/pip/web/popout', {recursive:true});
await copyFile('dist/web/popout/tray.html', 'dist/pip/web/popout/tray.html');
