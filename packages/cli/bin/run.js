#!/usr/bin/env -S node --no-warnings=ExperimentalWarning --enable-source-maps
async function main() {
  await import('disposablestack/auto')
  const { execute } = await import('@oclif/core')
  await execute({ dir: import.meta.url })
}

await main()
