#!/usr/bin/env -S node --loader ts-node/esm --no-warnings=ExperimentalWarning
// eslint-disable-next-line node/shebang
async function main() {
  process.env.NODE_ENV = 'development'
  const {execute} = await import('@oclif/core')
  await execute({development: true, dir: import.meta.url})
}

await main()
