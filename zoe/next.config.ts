import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Separate build dirs let e2e run beside a dev server.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // The floating dev badge covers the sidebar's "Switch user" button in demos.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite ships WASM + data files that must be loaded from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Serverless hosts only ship traced files: keep the SQL migrations and PGlite's wasm/data bundle.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*", "./node_modules/@electric-sql/pglite/dist/*.{wasm,data}"] },
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
