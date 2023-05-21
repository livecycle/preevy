import { sshKeysStore } from '../state'
import { MachineDriver } from '../driver'
import { Logger } from '../log'
import { Store } from '../store'
import { connectSshClient } from '../ssh'
import { queryTunnels } from '../compose-tunnel-agent-client'
import { FlatTunnel, flattenTunnels } from '../tunneling'

export const urls = async ({ log, envId, driver, store, debug, projectName, serviceAndPort }: {
  log: Logger
  envId: string
  projectName: string
  driver: MachineDriver
  store: Store
  debug: boolean
  serviceAndPort?: { service: string; port?: number }
}) => {
  const keyAlias = await driver.getKeyPairAlias()

  const keyStore = sshKeysStore(store)
  const sshKey = await keyStore.getKey(keyAlias)
  if (!sshKey) {
    throw new Error(`No key pair found for alias ${keyAlias}`)
  }

  const machine = await driver.getMachine({ envId })
  if (!machine) {
    throw new Error(`No machine found for envId ${envId}`)
  }

  const sshClient = await connectSshClient({
    debug,
    host: machine.publicIPAddress,
    username: machine.sshUsername,
    privateKey: sshKey.privateKey.toString('utf-8'),
    log,
  })

  try {
    const { tunnels } = await queryTunnels({ sshClient, projectName, retryOpts: { retries: 2 } })

    const flatTunnels: FlatTunnel[] = flattenTunnels(tunnels)
      .filter(tunnel => !serviceAndPort || (
        tunnel.service === serviceAndPort.service && (!serviceAndPort.port || tunnel.port === serviceAndPort.port)
      ))

    return flatTunnels
  } finally {
    sshClient.dispose()
  }
}
