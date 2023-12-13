import * as esbuild from 'esbuild'

const ESM_REQUIRE_SHIM = `
await (async () => {
  const { dirname } = await import("path");
  const { fileURLToPath } = await import("url");

  /**
   * Shim entry-point related paths.
   */
  if (typeof globalThis.__filename === "undefined") {
    globalThis.__filename = fileURLToPath(import.meta.url);
  }
  if (typeof globalThis.__dirname === "undefined") {
    globalThis.__dirname = dirname(globalThis.__filename);
  }
  /**
   * Shim require if needed.
   */
  if (typeof globalThis.require === "undefined") {
    const { default: module } = await import("module");
    globalThis.require = module.createRequire(import.meta.url);
  }
})();
`;

await esbuild.build({
  entryPoints: ['index.ts'],
  bundle: true,
  treeShaking: true,
  outdir: './out',
  platform: 'node',
  target: 'es2020',
  format: 'esm',
  loader: {
    '.node': 'file',
  },
  sourcemap: true,
  banner: { js: ESM_REQUIRE_SHIM },
  // banner:{
  //   js: `
  //   import { fileURLToPath as topLevelFileURLToPath } from 'url';
  //   import topLevelPath from 'path';
  //   import { createRequire as topLevelCreateRequire } from 'module';
  //   const require = topLevelCreateRequire(import.meta.url);
  //   const __filename = topLevelFileURLToPath(import.meta.url);
  //   const __dirname = topLevelPath.dirname(__filename);
  //   `
  // },
})
