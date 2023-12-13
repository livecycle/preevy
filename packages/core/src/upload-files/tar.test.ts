import { describe, expect, beforeAll, afterAll, test } from '@jest/globals'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { rimraf } from 'rimraf'
import { pseudoRandomBytes } from 'crypto'
import { tarStreamer } from './tar.js'
import { execPromise, execPromiseStdout } from '../child-process.js'

describe('tar', () => {
  let tempDir: string
  let sourceDir: string

  beforeAll(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'test-tar-'))
    sourceDir = path.join(tempDir, 'source')
    const d1 = path.join(sourceDir, 'd1')
    const d2 = path.join(sourceDir, 'd2')
    const d3 = path.join(d2, 'd3')
    await Promise.all([
      fs.promises.mkdir(d1, { recursive: true }),
      fs.promises.mkdir(d3, { recursive: true }),
    ])
    await Promise.all([
      fs.promises.writeFile(path.join(d1, 'f1.txt'), 'this is f1'),
      fs.promises.writeFile(path.join(d3, 'f2.txt'), ['this is f2', 'with multiple lines'].join(os.EOL)),
      fs.promises.writeFile(path.join(d3, 'blob1'), pseudoRandomBytes(100)),
    ])
    await fs.promises.symlink(path.join('d3', 'f2.txt'), path.join(d2, 'l2.txt'))
  })

  afterAll(async () => {
    if (tempDir) {
      await rimraf(tempDir)
    }
  })

  test('create a tar stream', async () => {
    const local1 = path.join(sourceDir, 'd1')
    const remote1 = 'bla/1'
    const local2 = path.join(sourceDir, 'd2')
    const remote2 = 'foo/2'

    const u = tarStreamer([{ local: local1, remote: remote1 }])
    u.add({ local: local2, remote: remote2 })

    const filename = path.join(tempDir, 'test.tar')
    const out = fs.createWriteStream(filename)
    const { done, totals, emitter } = u.startStreaming({ out, concurrency: 5 })
    let emittedBytes = 0
    const emittedFiles: string[] = []
    emitter.addListener('bytes', ({ bytes }) => { emittedBytes += bytes })
    emitter.addListener('file', file => { emittedFiles.push(file) })
    const { files, bytes } = await totals
    expect(bytes).toBeGreaterThan(0)
    expect(files).toBe(3)

    await done

    expect(emittedBytes).toEqual(bytes)
    expect(emittedFiles).toContain(path.join(local1, 'f1.txt'))
    expect(emittedFiles).toContain(path.join(local2, 'd3/blob1'))
    expect(emittedFiles).toContain(path.join(local2, 'd3/f2.txt'))
    expect(emittedFiles).toHaveLength(3)

    const outDir = path.join(tempDir, 'out')
    await fs.promises.mkdir(outDir, { recursive: true })
    await execPromise(`tar xf "${filename}" -C "${outDir}"`)
    expect(await execPromiseStdout(`diff -qr "${local1}" "${path.join(outDir, remote1)}"`)).toBe('')
    expect(await execPromiseStdout(`diff -qr "${local2}" "${path.join(outDir, remote2)}"`)).toBe('')
  })
})
