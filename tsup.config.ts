import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli/bin.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  sourcemap: true,
  shims: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
