import { rm } from "node:fs/promises";
import { build } from "esbuild";

await rm("dist-electron", { recursive: true, force: true });

await Promise.all([
  build({
    entryPoints: ["electron/main.ts"],
    outfile: "dist-electron/electron/main.js",
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    external: ["electron"],
    logLevel: "info",
  }),
  build({
    entryPoints: ["electron/preload.cts"],
    outfile: "dist-electron/electron/preload.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["electron"],
    logLevel: "info",
  }),
]);
