import * as k8s from '@kubernetes/client-node'
import { readable as isReadableStream } from 'is-stream'
import { ProcessOutputBuffers } from '@preevy/core'
import { Writable } from 'stream'
import { BaseExecOpts, ExecError, ReadableBufferStream, callbackWritableStream } from './common'

export class WebSocketExecError extends ExecError {
  constructor(
    readonly command: string[],
    readonly status: k8s.V1Status,
    readonly output: ProcessOutputBuffers,
    readonly code?: number
  ) {
    const message = status.message ?? code ? `Command ended with code ${code}` : 'WebSocket error'
    super(command, message, output, code)
  }
}

const extractCodeFromStatus = (status: k8s.V1Status) => {
  const n = Number(status.details?.causes?.find(({ reason }) => reason === 'ExitCode')?.message)
  return Number.isNaN(n) ? undefined : n
}

// DO NOT USE with stdin: WebSocket implementation of exec does not call the status callback when stdin is specified
// https://github.com/kubernetes/kubernetes/issues/89899
// https://github.com/kubernetes-client/javascript/issues/465
// Leaving stdin here, pending for a fix in the API
export default ({ k8sExec, namespace }: { k8sExec: k8s.Exec; namespace: string }) => {
  async function exec(opts: BaseExecOpts & { stdout: Writable; stderr: Writable }): Promise<{ code: number }>
  async function exec(opts: BaseExecOpts): Promise<{ code: number; output: ProcessOutputBuffers }>
  async function exec(
    opts: BaseExecOpts & { stdout?: Writable; stderr?: Writable },
  ): Promise<{ code: number; output?: ProcessOutputBuffers }> {
    const { pod, container, command } = opts
    const output: ProcessOutputBuffers = []
    const stdout = opts.stdout ?? callbackWritableStream(data => output.push({ data, stream: 'stdout' }))
    const stderr = opts.stderr ?? callbackWritableStream(data => output.push({ data, stream: 'stderr' }))
    const stdin = isReadableStream(opts.stdin) ? opts.stdin : new ReadableBufferStream(opts.stdin)

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
          reject(new WebSocketExecError(command, status, output, extractCodeFromStatus(status)))
        },
      )
    })
  }

  return exec
}
