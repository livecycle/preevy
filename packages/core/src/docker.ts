import { Logger } from './log'
import { MachineConnection, ForwardSocket } from './driver'
import { withSpinner } from './spinner'

export type FuncWrapper = <Return>(
  f: () => Promise<Return>,
) => Promise<Return>

const dockerHost = (s: string | ForwardSocket['address']) => (
  typeof s === 'string'
    ? `unix://${s}`
    : `tcp://${s.host}:${s.port}`
)

export const wrapWithDockerSocket = (
  { connection, log }: {
    connection: MachineConnection
    log: Logger
  },
): FuncWrapper => async <Return>(
  f: () => Promise<Return>,
): Promise<Return> => {
  const { address, close } = await withSpinner(
    () => connection.dockerSocket(),
    { text: 'Connecting to remote docker socket...', successText: 'Connected to remote docker socket' },
  )

  log.debug(`Local socket: ${JSON.stringify(address)}`)

  Object.keys(process.env).filter(k => k !== 'DOCKER_HOST' && k.startsWith('DOCKER_')).forEach(k => {
    log.warn(`deleting conflicting env var ${k}`)
    delete process.env[k]
  })

  process.env.DOCKER_HOST = dockerHost(address)

  return await f().finally(close)
}
