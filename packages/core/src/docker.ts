import { Logger } from './log'
import { MachineConnection, DockerSocket } from './driver'

export type FuncWrapper = <Return>(
  f: () => Promise<Return>,
) => Promise<Return>

const dockerHost = (s: string | DockerSocket['address']) => (
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
  const { address, close } = await connection.dockerSocket()
  // const { localSocket, close } = await connection.portForward({ port: 0, host: '0.0.0.0' }, '/var/run/docker.sock')

  log.debug(`Local socket: ${JSON.stringify(address)}`)

  Object.keys(process.env).filter(k => k !== 'DOCKER_HOST' && k.startsWith('DOCKER_')).forEach(k => {
    log.warn(`deleting conflicting env var ${k}`)
    delete process.env[k]
  })

  process.env.DOCKER_HOST = dockerHost(address)

  return f().finally(close)
}
