import path from 'path'
import util from 'util'
import fs from 'fs'
import { rimraf } from 'rimraf'
import { tarStream } from './tar'

const PREEVY_ROOT_DIR = path.resolve(__dirname, '..', '..', '..', '..')

const TARGET_FILE = '/tmp/aa.tar'

const log = (s: string, ...args: unknown[]) => {
  process.stderr.write(`${util.format(s, ...args)}\n`)
}

void (async () => {
  await rimraf(TARGET_FILE)
  const u = tarStream()
  u.add({ local: path.join(PREEVY_ROOT_DIR, 'node_modules'), remote: '/tmp/myprefix/node_modules' })
  const out = fs.createWriteStream(TARGET_FILE)
  log('calling finalize')
  const { totals, done } = u.finalize({ out, concurrency: 5 })
  log('finalize')
  log('counts', await totals)
  await done
  log('complete')
})()
