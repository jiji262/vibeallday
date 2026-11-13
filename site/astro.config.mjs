import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://vibeallday.navs.dpdns.org",
  integrations: [sitemap()],
  build: {
    format: "file",
  },
  trailingSlash: "never",
  server: {
    port: 3000,
    host: true,
  },
  vite: {
    server: {
      allowedHosts: ["localhost", ".vibeallday.navs.dpdns.org"],
    },
  },
});
