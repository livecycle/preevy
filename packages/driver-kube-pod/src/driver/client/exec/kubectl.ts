import { readable as isReadableStream } from 'is-stream'
import { ProcessOutputBuffers } from '@preevy/common'
import { Readable, Writable } from 'stream'
import { ChildProcess, StdioOptions, spawn } from 'child_process'
import { BaseExecOpts, ExecError, ReadableBufferStream, callbackWritableStream } from './common'

const isStreamWithFileDescriptor = (s: unknown) => typeof (s as { fd: number }).fd === 'number'

export class ProcessExecError extends ExecError {
  constructor(
    readonly command: string[],
    readonly process: ChildProcess,
    readonly output: ProcessOutputBuffers,
  ) {
    super(
      command,
      output,
      process.exitCode ?? undefined,
    )
  }
}

export default ({ kubeconfigLocation, context, namespace }: {
  kubeconfigLocation?: string
  context: string
  namespace: string
}) => {
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

    const stdio = [
      isStreamWithFileDescriptor(stdin) ? stdin : 'pipe',
      isStreamWithFileDescriptor(stdout) ? stdout : 'pipe',
      isStreamWithFileDescriptor(stderr) ? stderr : 'pipe',
    ] as StdioOptions

    const kubectlProcess = spawn(
      'kubectl',
      [
        kubeconfigLocation && `--kubeconfig=${kubeconfigLocation}`,
        `--context=${context}`,
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
      { stdio },
    )

    if (stdio[0] === 'pipe') {
      stdin.pipe(kubectlProcess.stdin as Writable)
    }
    if (stdio[1] === 'pipe') {
      (kubectlProcess.stdout as Readable).pipe(stdout)
    }
    if (stdio[2] === 'pipe') {
      (kubectlProcess.stderr as Readable).pipe(stderr)
    }

    return await new Promise((resolve, reject) => {
      kubectlProcess.on('exit', (code, signal) => {
        if (code || signal) {
          reject(new ProcessExecError(command, kubectlProcess, output))
          return
        }
        resolve({ code: 0, output })
      })
      kubectlProcess.on('error', reject)
    })
  }

  return exec
}
