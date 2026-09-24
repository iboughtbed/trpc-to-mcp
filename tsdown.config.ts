import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/server.ts",
    "src/tools.ts",
    "src/helpers.ts",
    "src/types.ts",
    "src/adapters/vercel-mcp-adapter.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  // Checks package.json exports against the build output.
  exports: true,
});
