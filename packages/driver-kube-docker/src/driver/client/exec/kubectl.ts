import { readable as isReadableStream } from 'is-stream'
import { ProcessError, ProcessOutputBuffers } from '@preevy/core'
import { Readable, Writable } from 'stream'
import { spawn } from 'child_process'
import { BaseExecOpts } from './common'

class ReadableBufferStream extends Readable {
  constructor(readonly buffer: Buffer | string | undefined) {
    super()
  }

  isRead = false

  // eslint-disable-next-line no-underscore-dangle
  _read(): void {
    if (this.isRead || !this.buffer) {
      this.push(null)
    } else {
      this.push(Buffer.isBuffer(this.buffer) ? this.buffer : Buffer.from(this.buffer as string))
    }
    this.isRead = true
  }
}

const callbackWritableStream = (onWrite: (chunk: Buffer) => void) => new Writable({
  write: (chunk: unknown, _encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void) => {
    onWrite(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
    setImmediate(callback)
  },
})

export default ({ kubeconfig, namespace }: { kubeconfig?: string; namespace: string }) => {
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

    const kubectlProcess = spawn(
      'kubectl',
      [
        kubeconfig && `--kubeconfig=${kubeconfig}`,
        `--namespace=${namespace}`,
        'exec',
        '--stdin',
        opts.tty && '--tty',
        pod,
        `--container=${container}`,
        '-q',
        '--',
        ...command,
      ].filter(Boolean) as string[],
      { stdio: 'pipe' },
    )

    stdin.pipe(kubectlProcess.stdin)
    kubectlProcess.stdout.pipe(stdout)
    kubectlProcess.stderr.pipe(stderr)

    console.log('spawn', kubectlProcess)

    return await new Promise((resolve, reject) => {
      kubectlProcess.on('exit', (code, signal) => {
        if (code || signal) {
          throw new ProcessError(kubectlProcess, code, signal, output)
        }
        resolve({ code: signal ? 1 : code as number, output })
      })
      kubectlProcess.on('error', reject)
    })
  }

  return exec
}
