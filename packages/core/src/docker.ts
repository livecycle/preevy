import { omitBy } from 'lodash'
import { Logger } from './log'
import { MachineConnection, ForwardSocket } from './driver'
import { withSpinner } from './spinner'

// export type FuncWrapper = <Return, Args extends unknown[] = []>(
//   f: (...args: Args) => Promise<Return>,
// ) => Promise<Return>

const dockerHost = (s: string | ForwardSocket['address']) => (
  typeof s === 'string'
    ? `unix://${s}`
    : `tcp://${s.host}:${s.port}`
)

export const dockerEnvContext = async (
  { connection, log, env = process.env }: {
    connection: Pick<MachineConnection, 'dockerSocket'>
    log: Logger
    env?: Record<string, string | undefined>
  },
): Promise<AsyncDisposable & { env: Record<string, string> }> => {
  const { address, [Symbol.asyncDispose]: dispose } = await withSpinner(
    () => connection.dockerSocket(),
    { text: 'Connecting to remote docker socket...', successText: 'Connected to remote docker socket' },
  )

  log.debug(`Local socket: ${JSON.stringify(address)}`)

  Object.keys(process.env).filter(k => k !== 'DOCKER_HOST' && k.startsWith('DOCKER_')).forEach(k => {
    log.warn(`deleting conflicting env var ${k}`)
    delete process.env[k]
  })

  return {
    env: {
      ...omitBy(env, (_, k) => k.startsWith('DOCKER_')),
      DOCKER_HOST: dockerHost(address),
    },
    [Symbol.asyncDispose]: dispose,
  }
}

// export const wrapWithDockerSocket = (
//   { connection, log }: {
//     connection: Pick<MachineConnection, 'dockerSocket'>
//     log: Logger
//   },
// ) => async <Return>(
//   f: (env: Record<string, string>) => Promise<Return>,
// ): Promise<Return> => {
//   const { address, close } = await withSpinner(
//     () => connection.dockerSocket(),
//     { text: 'Connecting to remote docker socket...', successText: 'Connected to remote docker socket' },
//   )

//   log.debug(`Local socket: ${JSON.stringify(address)}`)

//   Object.keys(process.env).filter(k => k !== 'DOCKER_HOST' && k.startsWith('DOCKER_')).forEach(k => {
//     log.warn(`deleting conflicting env var ${k}`)
//     delete process.env[k]
//   })

//   return await f({ DOCKER_HOST: dockerHost(address) }).finally(close)
// }
