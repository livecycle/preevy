import childProcess, { ChildProcess } from 'child_process'
import { Readable } from 'stream'
import { promisify } from 'util'

type Spawn = typeof childProcess['spawn']

export type ProcessOutputBuffers = { stream: 'stdout' | 'stderr'; data: Buffer }[]

export const orderedOutput = (buffers: ProcessOutputBuffers) => {
  const concatOutput = (
    predicate: (s: 'stdout' | 'stderr') => boolean,
  ) => Buffer.concat(buffers.filter(o => predicate(o.stream)).map(o => o.data))

  return {
    stdout: () => concatOutput(stream => stream === 'stdout'),
    stderr: () => concatOutput(stream => stream === 'stderr'),
    toProcess: (
      process: { stdout: NodeJS.WriteStream; stderr: NodeJS.WriteStream },
    ) => buffers.forEach(({ stream, data }) => process[stream].write(data)),
  }
}

const outputFromProcess = (process: { stdout?: Readable | null; stderr?: Readable | null }) => {
  const buffers: ProcessOutputBuffers = []

  process.stdout?.on('data', (data: Buffer) => buffers.push({ stream: 'stdout', data }))
  process.stderr?.on('data', (data: Buffer) => buffers.push({ stream: 'stderr', data }))

  return buffers
}

export class ProcessError extends Error {
  constructor(message: string, readonly process: childProcess.ChildProcess, readonly output?: ProcessOutputBuffers) {
    super(message)
  }
}

export function childProcessPromise(p: ChildProcess, opts?: { captureOutput?: false }): Promise<ChildProcess>
export function childProcessPromise(
  p: ChildProcess,
  opts: { captureOutput: true },
): Promise<ChildProcess & { output: ProcessOutputBuffers }>
export function childProcessPromise(p: ChildProcess, opts?: { captureOutput?: boolean }): Promise<ChildProcess> {
  return new Promise<ChildProcess>((resolve, reject) => {
    const output = opts?.captureOutput ? outputFromProcess(p) : undefined
    p.on('exit', (code, signal) => {
      if (code !== 0) {
        const message = `process exited with code ${code}${signal ? `and signal ${signal}` : ''}`
        reject(new ProcessError(message, p, output))
        return
      }
      resolve(Object.assign(p, { output }))
    })
  })
}

export const childProcessStdoutPromise = async (
  p: ChildProcess,
): Promise<string> => {
  const { output } = await childProcessPromise(p, { captureOutput: true })
  return orderedOutput(output).stdout().toString('utf-8').trim()
}

export const spawnPromise = (
  ...args: Parameters<Spawn>
) => childProcessPromise(childProcess.spawn(...args))

export const execPromise = promisify(childProcess.exec)

export const execPromiseStdout = async (command: string) => (await execPromise(command)).stdout.trim()
