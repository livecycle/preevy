import { baseSshClient, knownKeyHostVerifier, SshClientOpts, SshConnectionConfig } from './base-client.js'

export const checkConnection = async ({
  serverPublicKey,
  clientPrivateKey,
  sshUrl,
  username,
  onError,
}: Pick<SshClientOpts, 'clientPrivateKey' | 'sshUrl' | 'username' | 'onError' | 'serverPublicKey'>) => {
  let hostKey: Buffer | undefined
  let connectionConfig: SshConnectionConfig | undefined
  let isVerified = false
  const verifyKnownHost = serverPublicKey ? knownKeyHostVerifier(serverPublicKey) : () => false
  const hostVerifier = async (key: Buffer, config: SshConnectionConfig) => {
    hostKey = key
    connectionConfig = config
    isVerified = await verifyKnownHost(key)
    return true
  }

  const { ssh, execHello } = await baseSshClient({
    clientPrivateKey, sshUrl, username, onError, hostVerifier,
  })

  try {
    await execHello()
  } finally {
    ssh.end()
  }

  return { hostKey: (hostKey as Buffer).toString('base64'), ...connectionConfig, isVerified }
}
