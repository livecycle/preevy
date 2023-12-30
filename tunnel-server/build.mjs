import * as esbuild from 'esbuild'
import esbuildPluginPino from 'esbuild-plugin-pino'

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
  outdir: './dist',
  outExtension: { '.js': '.mjs' },
  platform: 'node',
  target: 'es2022',
  format: 'esm',
  loader: {
    '.node': 'file',
  },
  sourcemap: true,
  banner: { js: ESM_REQUIRE_SHIM },
  plugins: [
    esbuildPluginPino({ transports: ['pino-pretty'] }),
  ],
})
