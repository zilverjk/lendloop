import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
