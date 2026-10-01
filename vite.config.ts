import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: process.env.PAGES_BASE ?? "/powerroller/",
  build: { outDir: "dist" },
  server: { port: 9590 },
});
