// SPDX-License-Identifier: MIT
import {build} from "vite";
import {copyFile, writeFile} from "node:fs/promises";
if (!process.env.VITE_CONVEX_URL) throw new Error("Set VITE_CONVEX_URL for stats sign-in.");
await build({configFile: "vite.stats.config.ts"});
await copyFile("dist/stats/stats.html", "dist/stats/index.html");
await writeFile("dist/stats/robots.txt", "User-agent: *\nDisallow: /\n");
