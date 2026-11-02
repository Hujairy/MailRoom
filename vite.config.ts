import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { powerApps } from "@microsoft/power-apps-vite/plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), powerApps()],
  // Emit images as files rather than inline data URLs, which a strict
  // content security policy may block.
  build: { assetsInlineLimit: 0 },
});
