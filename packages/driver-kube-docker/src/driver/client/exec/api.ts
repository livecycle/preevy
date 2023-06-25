import * as k8s from '@kubernetes/client-node'
import { readable as isReadableStream } from 'is-stream'
import { ProcessOutputBuffers } from '@preevy/core'
import { Writable } from 'stream'
import { ReadableStreamBuffer } from 'stream-buffers'
import { BaseExecOpts } from './common'

const readbleStreamBufferFrom = (source?: string | Buffer) => {
  const result = new ReadableStreamBuffer()
  if (source !== undefined) {
    result.put(source)
  }
  return result
}

const callbackWritable = (onWrite: (chunk: Buffer) => void) => new Writable({
  write: (chunk: unknown, _encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void) => {
    onWrite(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
    setImmediate(callback)
  },
})

export class ExecError extends Error {
  constructor(
    readonly status: k8s.V1Status,
    readonly command: string[],
    readonly output: ProcessOutputBuffers,
  ) {
    super(status.message)
  }
}

const extractCodeFromStatus = (status: k8s.V1Status) => {
  const n = Number(status.details?.causes?.find(({ reason }) => reason === 'ExitCode')?.message)
  return Number.isNaN(n) ? undefined : n
}

// DO NOT USE with stdin:
// https://github.com/kubernetes/kubernetes/issues/89899
// https://github.com/kubernetes-client/javascript/issues/465
export default ({ k8sExec, namespace }: { k8sExec: k8s.Exec; namespace: string }) => {
  async function exec(opts: BaseExecOpts & { stdout: Writable; stderr: Writable }): Promise<{ code: number }>
  async function exec(opts: BaseExecOpts): Promise<{ code: number; output: ProcessOutputBuffers }>
  async function exec(
    opts: BaseExecOpts & { stdout?: Writable; stderr?: Writable },
  ): Promise<{ code: number; output?: ProcessOutputBuffers }> {
    const { pod, container, command } = opts
    const output: ProcessOutputBuffers = []
    const stdout = opts.stdout ?? callbackWritable(data => output.push({ data, stream: 'stdout' }))
    const stderr = opts.stderr ?? callbackWritable(data => output.push({ data, stream: 'stderr' }))
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
