#!/usr/bin/env -S NODE_OPTIONS=--no-warnings=ExperimentalWarning\_--enable-source-maps=\_--experimental-specifier-resolution=node ts-node --esm --swc
// eslint-disable-next-line node/shebang
async function main() {
  await import('disposablestack/auto')
  process.env.NODE_ENV = 'development'
  const {execute} = await import('@oclif/core')
  await execute({development: true, dir: import.meta.url})
}

await main()
