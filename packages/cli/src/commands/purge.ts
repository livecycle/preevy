import os from 'os'
import { Flags } from '@oclif/core'
import { asyncToArray } from 'iter-tools-es'
import DriverCommand from '../driver-command'
import { carefulBooleanPrompt } from '../lib/prompt'
import { sshKeysStore } from '../lib/state/ssh'

const confirmPurge = async (
  { driverFriendlyName, envIds, numberSnapshots, removeKeyPair }: {
    driverFriendlyName: string
    envIds: string[]
    numberSnapshots: number
    removeKeyPair: boolean
  },
) => {
  const resources = [
    ...envIds.map(e => `Machine for env ${e}`),
    numberSnapshots > 0 ? `${numberSnapshots} snapshot(s)` : '',
    removeKeyPair ? 'The profile key pair' : '',
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
  static description = 'Remove all cloud provider resources'

  static flags = {
    snapshots: Flags.boolean({
      description: 'Remove snapshots',
      default: true,
    }),
    machines: Flags.boolean({
      description: 'Remove machines',
      default: true,
    }),
    'key-pair': Flags.boolean({
      description: 'Remove key pair',
      default: false,
    }),
    all: Flags.boolean({
      description: 'Remove machines, snapshots and key pairs',
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

    const [removeMachines, removeSnapshots, removeKeyPair] = [
      flags.all || flags.machines,
      flags.all || flags.snapshots,
      flags.all || flags['key-pair'],
    ]

    const [machines, snapshots] = await Promise.all([
      removeMachines ? asyncToArray(driver.listMachines()) : [],
      removeSnapshots ? asyncToArray(driver.listSnapshots()) : [],
    ])

    if (!flags.force && !await confirmPurge({
      driverFriendlyName: driver.friendlyName,
      envIds: machines.map(m => m.envId),
      numberSnapshots: snapshots.length,
      removeKeyPair,
    })) {
      if (!flags.json) {
        this.logger.warn('Aborting purge')
      }
      return undefined
    }

    await Promise.all([
      ...machines.map(m => driver.removeMachine(m.providerId, flags.wait, m.envId)),
      ...snapshots.map(s => driver.removeSnapshot(s.providerId)),
    ])

    if (removeKeyPair) {
      const keyAlias = await driver.getKeyPairAlias()
      const keyStore = sshKeysStore(this.store)
      await keyStore.deleteKey(keyAlias)
      await driver.removeKeyPair(keyAlias)
    }

    if (flags.json) {
      return {
        machines: machines.map(m => m.envId),
        snapshots: snapshots.length,
        keyPair: removeKeyPair,
      }
    }

    if (machines.length > 0) {
      this.logger.info(`Deleted ${machines.length} machine(s)`)
    }

    if (snapshots.length > 0) {
      this.logger.info(`Deleted ${snapshots.length} snapshot(s)`)
    }

    if (removeKeyPair) {
      this.logger.info('Deleted the profile key pair')
    }

    return undefined
  }
}
