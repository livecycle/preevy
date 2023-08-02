import * as k8s from '@kubernetes/client-node'
import util from 'util'
import retry from 'p-retry'
import { readable as isReadableStream } from 'is-stream'
import { Logger } from '@preevy/core'
import { Writable } from 'stream'
import { ProcessOutputBuffers } from '@preevy/common'
import { BaseExecOpts, ExecError, ReadableBufferStream, callbackWritableStream } from './common'

export class WebSocketExecError extends ExecError {
  constructor(
    readonly command: string[],
    readonly status: k8s.V1Status,
    readonly output: ProcessOutputBuffers,
    readonly code?: number
  ) {
    super(command, output, code)
  }
}

const extractCodeFromStatus = (status: k8s.V1Status) => {
  const n = Number(status.details?.causes?.find(({ reason }) => reason === 'ExitCode')?.message)
  return Number.isNaN(n) ? undefined : n
}

class WebSocketExecInternalError extends Error {}

// DO NOT USE with stdin: WebSocket implementation of exec does not call the status callback when stdin is specified
// https://github.com/kubernetes/kubernetes/issues/89899
// https://github.com/kubernetes-client/javascript/issues/465
// Leaving stdin here, pending for a fix in the API
export default ({ k8sExec, namespace, log }: { k8sExec: k8s.Exec; namespace: string; log: Logger }) => {
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

    return await retry(() => new Promise((resolve, reject) => {
      let status: k8s.V1Status | undefined
      k8sExec.exec(
        namespace,
        pod,
        container,
        command,
        stdout,
        stderr,
        stdin,
        opts.tty ?? false,
        s => { status = s },
      ).then(ws => {
        ws.on('close', () => {
          if (!status) {
            reject(new WebSocketExecInternalError())
            return
          }
          if (status.status === 'Success') {
            resolve({ code: 0, output })
            return
          }
          reject(new WebSocketExecError(command, status, output, extractCodeFromStatus(status)))
        })
        ws.on('message', data => { log.debug('message', util.inspect(data.toString('utf-8'))) })
      }).catch(reject)
    }), {
      retries: 10,
      onFailedAttempt: err => {
        if (!(err instanceof WebSocketExecInternalError)) {
          log.warn('exec onFailedAttempt throwing', util.inspect(err))
          throw err
        }
      },
    })
  }

  return exec
}
