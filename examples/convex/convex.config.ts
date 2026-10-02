// SPDX-License-Identifier: MIT
import { defineApp } from 'convex/server';
import clickclacks from 'clickclacks/convex.config.js';
const app = defineApp();
app.use(clickclacks);
export default app;
