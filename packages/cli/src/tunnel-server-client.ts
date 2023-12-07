import {
  HostKeySignatureConfirmer,
  Logger,
  connectToTunnelServerSsh as baseConnect,
  TunnelOpts,
  Spinner,
  ProfileStore,
} from '@preevy/core'
import os from 'os'
import { ux } from '@oclif/core'
import { parseSshUrl } from '@preevy/common'
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

export const connectToTunnelServerSsh = async ({ tunnelOpts, log, tunnelingKey, profileStore, spinner }: {
  tunnelOpts: TunnelOpts
  tunnelingKey: string | Buffer
  profileStore: ProfileStore
  log: Logger
  spinner?: Spinner
}) => {
  const connectionOpts = parseSshUrl(tunnelOpts.url)
  const { hostname, port } = connectionOpts
  const knownServerPublicKeys = await profileStore.ref.knownServerPublicKeys(hostname, port)
  const connectionResult = await baseConnect({
    log,
    connectionOpts,
    tunnelOpts,
    clientPrivateKey: tunnelingKey,
    username: process.env.USER || 'preevy',
    confirmHostFingerprint: async (...args) => {
      spinner?.stop()
      return await confirmHostFingerprint(...args)
    },
    knownServerPublicKeys,
  })

  if (!connectionResult) {
    ux.log('Exiting')
    ux.exit(0)
  }

  if (!knownServerPublicKeys.includes(connectionResult.hostKey)) {
    await profileStore.transaction(async op => {
      await op.knownServerPublicKeys(hostname, port).write([...knownServerPublicKeys, connectionResult.hostKey])
    })
  }

  return connectionResult
}
