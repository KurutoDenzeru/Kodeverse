// @ts-check

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// The site's own absolute url, used by metadataBase and every absolute tag the
// head emits. It is read from the environment because the hosting url is not
// known at authoring time: set SITE_URL before `bun run build` and every
// canonical, Open Graph and sitemap url follows it. Without it the build still
// succeeds and the head omits only the absolute urls.
// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL,
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [react()],
});
