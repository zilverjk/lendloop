import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow loading dev assets and HMR when the dev server is opened over the tailnet
  // (hostname, MagicDNS name or IP) instead of localhost.
  allowedDevOrigins: ["zilver-server", "zilver-server.tailf21ed8.ts.net", "100.89.21.99"],
  // AGENTS.md is hand-written project guidance; stop `next dev` from injecting its managed block.
  agentRules: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
