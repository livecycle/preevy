import * as k8s from '@kubernetes/client-node'
import { readable as isReadableStream } from 'is-stream'
import { ProcessOutputBuffers } from '@preevy/core'
import { Readable, Writable } from 'stream'
import { ReadableStreamBuffer } from 'stream-buffers'

const readbleStreamBufferFrom = (source?: string | Buffer) => {
  const result = new ReadableStreamBuffer()
  if (source !== undefined) {
    result.put(source)
  }
  return result
}

class CallbackWritableStream extends Writable {
  constructor(readonly onWrite: (chunk: Buffer) => void) {
    super()
  }

  // eslint-disable-next-line no-underscore-dangle
  _write(chunk: unknown, _encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void): void {
    this.onWrite(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
    callback()
  }
}

export class ExecError extends Error {
  constructor(
    readonly status: k8s.V1Status,
    readonly command: string[],
    readonly output: ProcessOutputBuffers,
  ) {
    super(status.message)
  }
}

export type BaseExecOpts = {
  pod: string
  container: string
  command: string[]
  stdin?: string | Buffer | Readable
  tty?: boolean
}

const extractCodeFromStatus = (status: k8s.V1Status) => {
  const n = Number(status.details?.causes?.find(({ reason }) => reason === 'ExitCode')?.message)
  return Number.isNaN(n) ? undefined : n
}

export default ({ k8sExec, namespace }: { k8sExec: k8s.Exec; namespace: string }) => {
  async function exec(opts: BaseExecOpts & { stdout: Writable; stderr: Writable }): Promise<{ code: number }>
  async function exec(opts: BaseExecOpts): Promise<{ code: number; output: ProcessOutputBuffers }>
  async function exec(
    opts: BaseExecOpts & { stdout?: Writable; stderr?: Writable },
  ): Promise<{ code: number; output?: ProcessOutputBuffers }> {
    const { pod, container, command } = opts
    const output: ProcessOutputBuffers = []
    const stdout = opts.stdout ?? new CallbackWritableStream(data => output.push({ data, stream: 'stdout' }))
    const stderr = opts.stderr ?? new CallbackWritableStream(data => output.push({ data, stream: 'stderr' }))
    const stdin = isReadableStream(opts.stdin) ? opts.stdin : readbleStreamBufferFrom(opts.stdin)

    return await new Promise((resolve, reject) => {
      void k8sExec.exec(
        namespace,
        pod,
        container,
        command,
        stdout,
        stderr,
        stdin,
        opts.tty ?? false,
        status => {
          if (status.status === 'Success') {
            resolve({ code: 0, output })
            return
          }
          const code = extractCodeFromStatus(status)
          if (code !== undefined) {
            resolve({ code, output })
            return
          }
          reject(new ExecError(status, command, output))
        },
      )
    })
  }

  return exec
}
