import childProcess, { ChildProcess } from 'child_process'
import { Readable } from 'stream'
import { promisify } from 'util'

type Spawn = typeof childProcess['spawn']

type StdoutStream = 'stdout' | 'stderr'
export type ProcessOutputBuffers = { stream: StdoutStream; data: Buffer }[]

export const orderedOutput = (buffers: ProcessOutputBuffers) => {
  const concatOutput = (
    predicate: (s: StdoutStream) => boolean,
  ) => Buffer.concat(buffers.filter(({ stream }) => predicate(stream)).map(({ data }) => data))

  return {
    stdout: () => concatOutput(stream => stream === 'stdout'),
    stderr: () => concatOutput(stream => stream === 'stderr'),
    both: () => concatOutput(() => true),
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
  constructor(
    readonly process: childProcess.ChildProcess,
    readonly code: number | null,
    readonly signal: NodeJS.Signals | null,
    readonly output?: ProcessOutputBuffers,
  ) {
    const message = [
      `process \`${process.spawnargs.join(' ')}\` exited with code ${code}${signal ? `and signal ${signal}` : ''}`,
      output ? orderedOutput(output).both().toString('utf-8') : undefined,
    ].filter(Boolean).join(': ')
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
        reject(new ProcessError(p, code, signal, output))
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
