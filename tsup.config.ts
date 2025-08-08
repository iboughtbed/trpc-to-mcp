import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/server.ts",
    "src/tools.ts",
    "src/adapters/vercel-mcp-adapter.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
});
