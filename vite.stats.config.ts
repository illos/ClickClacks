// SPDX-License-Identifier: MIT
import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({base: "/", plugins: [react()], publicDir: false,
  build: {outDir: "dist/stats", rollupOptions: {input: "stats.html"}},
});
