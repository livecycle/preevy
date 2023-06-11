import { MachineDriver } from '../driver/driver'
import { Logger } from '../log'
import { queryTunnels } from '../compose-tunnel-agent-client'
import { flattenTunnels } from '../tunneling'
import { remoteProjectDir } from '../remote-files'
import { isPartialMachine } from '../driver'

export const urls = async ({ log, envId, driver, debug, projectName, serviceAndPort }: {
  log: Logger
  envId: string
  projectName: string
  driver: MachineDriver
  debug: boolean
  serviceAndPort?: { service: string; port?: number }
}) => {
  const projectDir = remoteProjectDir(projectName)

  const machine = await driver.getMachine({ envId })
  if (!machine || isPartialMachine(machine)) {
    throw new Error(`No machine found for envId ${envId}`)
  }

  const connection = await driver.connect(machine, { log, debug })

  try {
    const { tunnels } = await queryTunnels({ connection, remoteProjectDir: projectDir, retryOpts: { retries: 2 } })

    return flattenTunnels(tunnels)
      .filter(tunnel => !serviceAndPort || (
        tunnel.service === serviceAndPort.service && (!serviceAndPort.port || tunnel.port === serviceAndPort.port)
      ))
  } finally {
    await connection.close()
  }
}
