// SPDX-License-Identifier: MIT
import { defineApp } from 'convex/server';
import powerroller from 'powerroller/convex.config.js';
const app = defineApp();
app.use(powerroller);
export default app;
