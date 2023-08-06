import { Writable } from 'node:stream'
import Dockerode from 'dockerode'
import {
  DockerMachineStatusCommandRecipe,
  Logger,
  MachineStatusCommand,
  ProcessOutputBuffers,
  orderedOutput,
} from '@preevy/common'

const callbackWritableStream = (onWrite: (chunk: Buffer) => void) => new Writable({
  write: (chunk: unknown, _encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void) => {
    onWrite(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
    callback()
  },
})

const resolveInterpolation = ({ env, log }: { env: NodeJS.ProcessEnv; log: Logger }) => (
  s: string,
) => s.replaceAll(
  /\$\{([a-zA-Z][a-zA-Z0-9_]+)\}/g,
  (_, varName) => {
    const varValue = env[varName]
    if (varValue === undefined) {
      log.warn('Missing environment variable "%s", replacing with empty string', varName)
    }
    return varValue ?? ''
  },
)

const runDockerMachineStatusCommand = (
  { log, docker, env: processEnv }: {
    log: Logger
    docker: Dockerode
    env: NodeJS.ProcessEnv
  },
) => {
  const isNotFoundError = (err: unknown) => (err as { statusCode?: unknown }).statusCode === 404
  const envResolve = resolveInterpolation({ log, env: processEnv })

  return async (
    { image, command, tty, entrypoint, network, env, bindMounts }: DockerMachineStatusCommandRecipe
  ) => {
    const output: ProcessOutputBuffers = []
    const stdoutStream = callbackWritableStream(data => output.push({ stream: 'stdout', data }))
    const stderrStream = callbackWritableStream(data => output.push({ stream: 'stderr', data }))

    const run = async () => await docker.run(image, command as string[], [stdoutStream, stderrStream], {
      ...(tty !== undefined ? { Tty: false } : {}),
      ...(entrypoint !== undefined ? { Entrypoint: entrypoint } : {}),
      ...(env !== undefined) ? { Env: Object.entries(env).map(([k, v]) => `${k}=${envResolve(v)}`) } : {},
      HostConfig: {
        AutoRemove: true,
        Binds: bindMounts,
        ...(network !== undefined ? { NetworkMode: network } : {}),
      },
    })

    let runResult: [{ StatusCode: number }]
    try {
      runResult = await run()
    } catch (err) {
      if (!isNotFoundError(err)) {
        throw err
      }
      log.debug('image not found, pulling image: %s', image)
      const pullStream = await docker.pull(image)
      await new Promise(res => { docker.modem.followProgress(pullStream, res) })
      runResult = await run()
    }

    return { output, exitCode: runResult[0].StatusCode }
  }
}

export const runMachineStatusCommand = (
  { log, docker, env }: {
    log: Logger
    docker: Dockerode
    env: NodeJS.ProcessEnv
  }
) => {
  const runDocker = runDockerMachineStatusCommand({ log, docker, env })
  return async (
    { recipe: run, contentType }: MachineStatusCommand,
  ) => {
    log.debug('running machine status command: %j', run)
    if (run.type !== 'docker') {
      throw new Error(`Unsupported machine status command "${run.type}"`)
    }
    const { output, exitCode } = await runDocker(run)
    const oo = orderedOutput(output)
    if (exitCode !== 0) {
      throw new Error(`Machine status command failed with code ${exitCode}: ${oo.output().toString('utf-8')}`)
    }
    return { contentType, data: oo.stdout() }
  }
}
