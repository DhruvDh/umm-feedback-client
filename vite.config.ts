import solid from "solid-start/vite";
import { defineConfig } from "vite";
import devtools from "solid-devtools/vite";
import cloudflare from "solid-start-cloudflare-pages";

export default defineConfig({
  plugins: [
    devtools({
      /* additional options */
      autoname: true, // e.g. enable autoname
      locator: {
        targetIDE: "vscode",
        componentLocation: true,
        jsxLocation: true,
      },
    }),
    solid({ ssr: false, adapter: cloudflare({}) }),
    // solid({ ssr: false }),
  ],
});
