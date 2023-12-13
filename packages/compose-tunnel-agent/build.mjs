import * as esbuild from 'esbuild'

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
})
