import {
  HostKeySignatureConfirmer,
  Logger,
  ProfileStore,
  connectToTunnelServerSsh as baseConnect,
  TunnelOpts,
  Spinner,
} from '@preevy/core'
import os from 'os'
import { ux } from '@oclif/core'
import { carefulBooleanPrompt } from './prompt'

const confirmHostFingerprint = async (
  { hostKeyFingerprint: hostKeySignature, hostname, port }: Parameters<HostKeySignatureConfirmer>[0],
) => {
  const formattedHost = port ? `${hostname}:${port}` : hostname
  const message = [
    `The authenticity of host '${formattedHost}' can't be established.`,
    `Key fingerprint is ${hostKeySignature}`,
    'Are you sure you want to continue connecting (yes/no)?',
  ].join(os.EOL)
  return await carefulBooleanPrompt(message)
}

export const connectToTunnelServerSsh = async ({ tunnelOpts, log, tunnelingKey, knownServerPublicKeys, spinner }: {
  tunnelOpts: TunnelOpts
  tunnelingKey: string | Buffer
  knownServerPublicKeys: ProfileStore['knownServerPublicKeys']
  log: Logger
  spinner?: Spinner
}) => {
  const connectionResult = await baseConnect({
    log,
    tunnelOpts,
    clientPrivateKey: tunnelingKey,
    username: process.env.USER || 'preview',
    confirmHostFingerprint: async (...args) => {
      spinner?.stop()
      return await confirmHostFingerprint(...args)
    },
    keysState: knownServerPublicKeys,
  })

  if (!connectionResult) {
    ux.log('Exiting')
    ux.exit(0)
  }

  return connectionResult
}
