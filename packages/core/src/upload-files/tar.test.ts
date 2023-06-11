import { describe, expect, beforeAll, afterAll, test } from '@jest/globals'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { rimraf } from 'rimraf'
import { tarStream } from './tar'
import { execPromise, execPromiseStdout } from '../child-process'

const TEST_FILE_DIR = path.join(__dirname, 'test', 'tar')

describe('tar', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'test-tar-'))
  })

  afterAll(async () => {
    if (tempDir) {
      await rimraf(tempDir)
    }
  })

  test('create a tar stream', async () => {
    const local1 = path.join(TEST_FILE_DIR, 'd1')
    const remote1 = 'bla/1'
    const local2 = path.join(TEST_FILE_DIR, 'd2')
    const remote2 = 'foo/2'

    const u = tarStream([{ local: local1, remote: remote1 }])
    u.add({ local: local2, remote: remote2 })

    const filename = path.join(tempDir, 'test.tar')
    const out = fs.createWriteStream(filename)
    const { done, totals, emitter } = u.finalize({ out, concurrency: 5 })
    let emittedBytes = 0
    const emittedFiles: string[] = []
    emitter.addListener('bytes', ({ bytes }) => { emittedBytes += bytes })
    emitter.addListener('file', file => { emittedFiles.push(file) })
    const { files, bytes } = await totals
    expect(bytes).toBeGreaterThan(0)
    expect(files).toBe(3)

    await done

    expect(emittedBytes).toEqual(bytes)
    expect(emittedFiles).toEqual([
      path.join(local1, 'f1.txt'),
      path.join(local2, 'd3/blob1'),
      path.join(local2, 'd3/f2.txt'),
    ])

    const outDir = path.join(tempDir, 'out')
    await fs.promises.mkdir(outDir, { recursive: true })
    await execPromise(`tar xf "${filename}" -C "${outDir}"`)
    expect(await execPromiseStdout(`diff -qe "${local1}" "${path.join(outDir, remote1)}"`)).toBe('')
    expect(await execPromiseStdout(`diff -qr "${local2}" "${path.join(outDir, remote2)}"`)).toBe('')
  })
})
