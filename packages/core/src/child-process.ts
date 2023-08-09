import { ProcessOutputBuffers, orderedOutput } from '@preevy/common'
import childProcess, { ChildProcess } from 'child_process'
import { Readable, Writable } from 'stream'
import { promisify } from 'util'

type Spawn = typeof childProcess['spawn']

export const outputFromStdio = ({ stdout, stderr }: { stdout?: Readable | null; stderr?: Readable | null }) => {
  const buffers: ProcessOutputBuffers = []

  stdout?.on('data', (data: Buffer) => buffers.push({ stream: 'stdout', data }))
  stderr?.on('data', (data: Buffer) => buffers.push({ stream: 'stderr', data }))

  return buffers
}

export class ProcessError extends Error {
  constructor(
    readonly process: childProcess.ChildProcess,
    readonly code: number | null,
    readonly signal: NodeJS.Signals | null,
    readonly output?: ProcessOutputBuffers,
  ) {
    super(ProcessError.calcMessage(process.spawnargs, code, signal, output))
  }

  static calcMessage(
    command: string[],
    code: number | null,
    signal: NodeJS.Signals | null,
    output?: ProcessOutputBuffers,
  ) {
    return [
      `command \`${command.join(' ')}\` exited with code ${code}${signal ? `and signal ${signal}` : ''}`,
      output ? orderedOutput(output).output().toString('utf-8') : undefined,
    ].filter(Boolean).join(': ')
  }
}

export function childProcessPromise(p: ChildProcess, opts?: { captureOutput?: false }): Promise<ChildProcess>
export function childProcessPromise(
  p: ChildProcess,
  opts: { captureOutput: true },
): Promise<ChildProcess & { output: ProcessOutputBuffers }>
export function childProcessPromise(p: ChildProcess, opts?: { captureOutput?: boolean }): Promise<ChildProcess> {
  return new Promise<ChildProcess>((resolve, reject) => {
    const output = opts?.captureOutput ? outputFromStdio(p) : undefined
    p.on('error', reject)
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

export const spawnPromise = async (
  ...args: Parameters<Spawn>
) => await childProcessPromise(childProcess.spawn(...args))

export const execPromise = promisify(childProcess.exec)

export const execPromiseStdout = async (command: string) => (await execPromise(command)).stdout.trim()

export type PartialStdioStringOption = 'inherit' | 'ignore'
export type PartialStdioOptions = PartialStdioStringOption
      | [PartialStdioStringOption | Readable, PartialStdioStringOption | Writable, PartialStdioStringOption | Writable]

const expandStdio = <T extends Readable | Writable>(o: PartialStdioStringOption | T, inherit: T, def: () => T): T => {
  if (typeof o !== 'string') {
    return o
  }
  if (o === 'inherit') {
    return inherit
  }
  return def()
}

const devNullReadable = () => new Readable({ read: () => undefined })
const devNullWritable = () => new Writable({ write: (...[, , cb]) => { setImmediate(cb) } })

export const expandStdioOptions = (o: PartialStdioOptions): { stdin: Readable; stdout: Writable; stderr: Writable } => {
  const oo = Array.isArray(o) ? o : [o, o, o]
  return {
    stdin: expandStdio<Readable>(oo[0], process.stdin, devNullReadable),
    stdout: expandStdio<Writable>(oo[1], process.stdout, devNullWritable),
    stderr: expandStdio<Writable>(oo[2], process.stderr, devNullWritable),
  }
}
