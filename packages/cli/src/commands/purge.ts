import os from 'os'
import { Flags } from '@oclif/core'
import { asyncToArray } from 'iter-tools-es'
import { groupBy } from 'lodash'
import DriverCommand from '../driver-command'
import { carefulBooleanPrompt } from '../prompt'

const confirmPurge = async (
  { driverFriendlyName, envIds, groupedOtherResources, pluralTypeName }: {
    driverFriendlyName: string
    envIds: string[]
    groupedOtherResources: [type: string, count: number][]
    pluralTypeName: (t: string) => string
  },
) => {
  const resources = [
    ...envIds.map(e => `Machine for env ${e}`),
    ...groupedOtherResources.map(([type, count]) => `${count > 1 ? pluralTypeName(type) : type} (${count})`),
  ].filter(Boolean)

  if (!resources.length) {
    return true
  }

  const message = [
    `About to delete the following resources from ${driverFriendlyName}:`,
    ...resources.map(e => `* ${e}`),
    'This action is irreversible!',
    'Are you sure you want to continue deleting (yes/no)?',
  ].join(os.EOL)
  return carefulBooleanPrompt(message)
}

// eslint-disable-next-line no-use-before-define
export default class Purge extends DriverCommand<typeof Purge> {
  static description = 'Delete all cloud provider machines, and potentially other resources'

  static flags = {
    all: Flags.boolean({
      description: 'Remove not just machines, but all resources (snapshots, keypairs, and other resource types)',
      default: false,
    }),
    force: Flags.boolean({
      description: 'Do not ask for confirmation',
      default: false,
    }),
    wait: Flags.boolean({
      description: 'Wait for resource deletion to complete. If false (the default), the deletion will be started but not waited for',
      default: false,
    }),
  }

  static enableJsonFlag = true

  static strict = false

  async run(): Promise<unknown> {
    const { flags } = await this.parse(Purge)

    const driver = await this.driver()

    const [machines, otherResources] = await Promise.all([
      asyncToArray(driver.listMachines()),
      flags.all ? asyncToArray(driver.listNonMachineResources()) : [],
    ])

    const groupedOtherResources = Object.entries(
      groupBy(otherResources, ({ type }) => type)
    ).map(([type, resources]) => [type, resources.length] as [string, number])

    if (!flags.force && !await confirmPurge({
      driverFriendlyName: driver.friendlyName,
      envIds: machines.map(m => m.envId),
      groupedOtherResources,
      pluralTypeName: driver.pluralNonMachineResourceType,
    })) {
      if (!flags.json) {
        this.logger.warn('Aborting purge')
      }
      return undefined
    }

    await Promise.all([
      ...machines.map(m => driver.removeMachine(m.providerId, flags.wait)),
      ...otherResources.map(s => driver.removeNonMachineResource(s, flags.wait)),
    ])

    // if (removeKeyPair) {
    //   const keyAlias = await driver.getKeyPairAlias()
    //   const keyStore = sshKeysStore(this.store)
    //   await keyStore.deleteKey(keyAlias)
    //   await driver.removeKeyPair(keyAlias)
    // }

    if (flags.json) {
      return {
        machines: machines.map(m => m.envId),
        otherResources,
      }
    }

    const action = flags.wait ? 'Deleted' : 'Started deletion of'

    if (machines.length > 0) {
      this.logger.info(`${action} ${machines.length} machine${machines.length > 1 ? 's' : ''}`)
    }

    groupedOtherResources.forEach(([type, count]) => {
      this.logger.info(`${action} ${count} ${count > 1 ? driver.pluralNonMachineResourceType(type) : type}`)
    })

    return undefined
  }
}
