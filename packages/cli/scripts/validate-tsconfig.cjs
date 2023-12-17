#!/usr/bin/env node
const path = require('path')
const util = require('util')
const fs = require('fs')

const tsConfig = path.join(__dirname, '..', './tsconfig.json')

try {
  JSON.parse(fs.readFileSync('./tsconfig.json'))
} catch (e) {
  console.error('Error parsing %s: oclif expects valid JSON: %j', tsConfig, util.inspect(e))
  process.exit(1)
}

