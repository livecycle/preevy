import os from 'os'
import { Flags, ux } from '@oclif/core'
import { asyncFilter, asyncToArray } from 'iter-tools-es'
import { groupBy, partition } from 'lodash'
import { MachineResource, isPartialMachine, machineResourceType } from '@preevy/core'
import DriverCommand from '../driver-command'
import { carefulBooleanPrompt } from '../prompt'

const isMachineResource = (r: { type: string }): r is MachineResource => r.type === machineResourceType

const confirmPurge = async (
  { driverFriendlyName, envIds, groupedNonMachineResources, resourcePlurals }: {
    driverFriendlyName: string
    envIds: string[]
    groupedNonMachineResources: [type: string, count: number][]
    resourcePlurals: Record<string, string>
  },
) => {
  const resources = [
    ...envIds.map(e => `Environment ${e}`),
    ...groupedNonMachineResources.map(([type, count]) => `${count} ${count > 1 ? resourcePlurals[type] : type}`),
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
  return await carefulBooleanPrompt(message)
}

// eslint-disable-next-line no-use-before-define
export default class Purge extends DriverCommand<typeof Purge> {
  static description = 'Delete all cloud provider machines, and potentially other resources'

  static flags = {
    all: Flags.boolean({
      description: 'Remove all resources types (snapshots, keypairs, and other resource types)',
      default: false,
    }),
    type: Flags.string({
      description: 'Resource type(s) to delete',
      default: [machineResourceType],
      multiple: true,
      singleValue: true,
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
    const resourcePlurals: Record<string, string> = { [machineResourceType]: 'machines', ...driver.resourcePlurals }
    const driverResourceTypes = new Set(Object.keys(resourcePlurals))

    flags.type.forEach(type => {
      if (!driverResourceTypes.has(type)) {
        ux.error(
          `Unknown resource type "${type}". Available resource types: ${Array.from(driverResourceTypes).join(', ')}`,
          { exit: 1 },
        )
      }
    })

    const allResources = await asyncToArray(
      asyncFilter(
        ({ type }) => flags.all || flags.type.includes(type),
        driver.listDeletableResources(),
      ),
    )

    const [machines, nonMachineResources] = partition(allResources, isMachineResource)
    const [partialMachines, envMachines] = partition(machines, isPartialMachine)

    const groupedNonMachineResources = Object.entries(
      groupBy([...partialMachines, ...nonMachineResources], ({ type }) => type)
    ).map(([type, resources]) => [type, resources.length] as [string, number])

    if (!flags.force && !await confirmPurge({
      driverFriendlyName: driver.friendlyName,
      envIds: envMachines.map(m => m.envId),
      groupedNonMachineResources,
      resourcePlurals,
    })) {
      if (!flags.json) {
        this.logger.warn('Aborting purge')
      }
      return undefined
    }

    await driver.deleteResources(flags.wait, ...allResources)

    if (flags.json) {
      return allResources
    }

    const action = flags.wait ? 'Deleted' : 'Started deletion of'

    if (machines.length > 0) {
      this.logger.info(`${action} ${machines.length} machine${machines.length > 1 ? 's' : ''}`)
    }

    groupedNonMachineResources.forEach(([type, count]) => {
      this.logger.info(`${action} ${count} ${count > 1 ? resourcePlurals[type] : type}`)
    })

    return undefined
  }
}
