import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "static",
  adapter: cloudflare(),
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
  },
});
