import { DockerMachineStatusCommandRecipe, Logger, ProcessOutputBuffers, orderedOutput } from '@preevy/common'
import Dockerode from 'dockerode'
import { Writable } from 'stream'
import { inspect } from 'util'

const callbackWritableStream = (onWrite: (chunk: Buffer) => void) => new Writable({
  write: (chunk: unknown, _encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void) => {
    onWrite(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
    callback()
  },
})

const isNotFoundError = (err: unknown) => (err as { statusCode?: unknown }).statusCode === 404
const retryOnNotFound = async <T>(f: () => Promise<T>, onNotFound: () => Promise<void>) => {
  try {
    return await f()
  } catch (err) {
    if (!isNotFoundError(err)) throw err
    await onNotFound()
    return await f()
  }
}

export const runDockerMachineStatusCommand = (
  { log, docker }: {
    log: Logger
    docker: Dockerode
  },
) => {
  const followProgressPromise = (stream: NodeJS.ReadableStream) => new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(
      stream,
      err => { if (err) { reject(err) } else { resolve() } },
      obj => log.debug('pull progress: %j', obj),
    )
  })

  return async (recipe: DockerMachineStatusCommandRecipe) => {
    const { image, command, tty, entrypoint, network, env, bindMounts } = recipe
    const pull = async () => await followProgressPromise(await docker.pull(image))

    const output: ProcessOutputBuffers = []
    const stdoutStream = callbackWritableStream(data => output.push({ stream: 'stdout', data }))
    const stderrStream = callbackWritableStream(data => output.push({ stream: 'stderr', data }))

    const run = async () => await docker.run(image, command as string[], [stdoutStream, stderrStream], {
      ...(tty !== undefined ? { Tty: false } : {}),
      ...(entrypoint !== undefined ? { Entrypoint: entrypoint } : {}),
      ...(env !== undefined) ? { Env: Object.entries(env).map(kv => kv.join('=')) } : {},
      HostConfig: {
        AutoRemove: true,
        Binds: bindMounts,
        ...(network !== undefined ? { NetworkMode: network } : {}),
      },
    })

    const runResult = await retryOnNotFound(run, async () => {
      log.debug('image not found, pulling: %j', image)
      await pull()
    })

    const exitCode = runResult[0].StatusCode
    const oo = orderedOutput(output)
    if (exitCode !== 0) {
      const outputStr = oo.output().toString('utf-8')
      throw new Error(`error running machineStatusCommand ${inspect(recipe)}: exit code ${exitCode}: ${outputStr}`)
    }
    return oo.stdout()
  }
}
