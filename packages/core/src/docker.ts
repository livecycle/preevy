import { AddressInfo } from 'net'
import { SshClient } from './ssh/client'
import { Logger } from './log'

export type FuncWrapper = <Return>(
  f: () => Promise<Return>,
) => Promise<Return>

const dockerHost = (s: string | AddressInfo) => (
  typeof s === 'string'
    ? `unix://${s}`
    : `tcp://${s.address}:${s.port}`
)

export const wrapWithDockerSocket = (
  { sshClient, log }: {
    sshClient: SshClient
    log: Logger
  },
): FuncWrapper => async <Return>(
  f: () => Promise<Return>,
): Promise<Return> => {
  const { localSocket, close } = await sshClient.forwardOutStreamLocal({ port: 0, host: '0.0.0.0' }, '/var/run/docker.sock')

  log.debug(`Local socket: ${JSON.stringify(localSocket)}`)

  Object.keys(process.env).filter(k => k !== 'DOCKER_HOST' && k.startsWith('DOCKER_')).forEach(k => {
    log.warn(`deleting conflicting env var ${k}`)
    delete process.env[k]
  })

  process.env.DOCKER_HOST = dockerHost(localSocket)

  return f().finally(close)
}
