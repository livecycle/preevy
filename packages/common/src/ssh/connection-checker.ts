import { baseSshClient, HelloResponse, SshClientOpts } from './base-client'

export type ConnectionCheckResult = (Pick<HelloResponse, 'clientId' | 'baseUrl'> & { hostKey: Buffer }) | {
  error: Error
} | {
  unverifiedHostKey: Buffer
}

export const checkConnection = ({
  log, connectionConfig,
}: Pick<SshClientOpts, 'log' | 'connectionConfig'>) => new Promise<ConnectionCheckResult>(resolve => {
  let hostKey: Buffer
  baseSshClient({
    log,
    connectionConfig,
    onHostKey: (key, verified) => {
      hostKey = key
      if (!verified) {
        resolve({ unverifiedHostKey: key })
      }
    },
  }).then(
    ({ ssh, execHello }) => {
      execHello()
        .then(
          ({ clientId, baseUrl }) => resolve({ clientId, hostKey, baseUrl }),
          err => resolve({ error: err })
        )
        .finally(() => ssh.end())
    },
    err => resolve({ error: err }),
  )
})
