#!/usr/bin/env node
async function main() {
  const {execute} = await import('@oclif/core')
  await execute({dir: import.meta.url})
}

await main()
