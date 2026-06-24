import { defineConfig } from "tsup";

/**
 * Bundle only our own source; every runtime dependency (ink, react, viem, the
 * Polymarket SDK, …) is resolved from node_modules at runtime so the published
 * artifact stays small. Code-splitting keeps the Ink UI in its own chunk that
 * is only loaded when a command dynamically imports it (interactive mode).
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  splitting: true,
  clean: true,
  dts: false,
  sourcemap: false,
  minify: false,
  shims: false,
  // Resolve all runtime deps from node_modules; never bundle them. The optional
  // trading deps (viem, the CLOB SDK) must stay external so they can be absent.
  external: [/^viem/, "@polymarket/clob-client", /^@polymarket\//],
});
