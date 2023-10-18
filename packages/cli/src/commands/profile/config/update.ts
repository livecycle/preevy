import { profileStore } from '@preevy/core'
import { Flags, ux } from '@oclif/core'
import { mapValues, omit, pickBy } from 'lodash'
import {
  removeDriverFlagPrefix,
  extractDriverFlags,
  flagsForAllDrivers,
  machineCreationflagsForAllDrivers,
  DriverName,
  driverFlags,
  machineCreationDriverFlags,
} from '../../../drivers'
import ProfileCommand from '../../../profile-command'
import DriverCommand from '../../../driver-command'

const removeDefaultValues = <T extends Record<string, { default?: unknown }>>(
  flags: T
): T => mapValues(flags, v => omit(v as object, 'default')) as T

const allDriverFlags = Object.freeze({
  ...flagsForAllDrivers,
  ...machineCreationflagsForAllDrivers,
})

const removeRequiredFlags = <
  T extends Record<string, { required?: boolean }>
>(flags: T) => pickBy(flags, v => !v.required)

const allNonRequiredDriverFlags = new Set(Object.keys(removeRequiredFlags(allDriverFlags)))

const validateUnset = (driver: DriverName, unset: string[]) => {
  const flagsForDriver = { ...driverFlags(driver), ...machineCreationDriverFlags(driver) }
  const driverFlagsAvailableToUnset = new Set(Object.keys(removeRequiredFlags(flagsForDriver)))

  const unknownUnset = unset.filter(k => !driverFlagsAvailableToUnset.has(k))
  if (unknownUnset.length) {
    ux.error(`Unknown unset values for driver ${driver}: ${unknownUnset.join(', ')}. Available options to unset: ${[...driverFlagsAvailableToUnset.keys()].join(', ')}`, { exit: 1 })
  }
}

// eslint-disable-next-line no-use-before-define
export default class UpdateProfileConfig extends ProfileCommand<typeof UpdateProfileConfig> {
  static description = 'View and update profile configuration'

  static flags = {
    ...removeDefaultValues(allDriverFlags),
    driver: DriverCommand.baseFlags.driver,
    unset: Flags.string({
      options: [...allNonRequiredDriverFlags],
      description: 'Unset a configuration option',
      default: [],
      multiple: true,
    }),
  }

  static strict = false

  static enableJsonFlag = true

  async run(): Promise<void> {
    const pStore = profileStore(this.store)
    const profileDriver = this.profile.driver as DriverName | undefined
    const driver: DriverName | undefined = (this.flags.driver || profileDriver)
    if (!driver) {
      ux.error('Missing driver configuration in profile, use the --driver flag to set the desired machine driver')
    }
    if (driver !== profileDriver) {
      await pStore.updateDriver(driver)
    }

    const { unset } = this.flags
    validateUnset(driver, unset)

    const source = await pStore.defaultFlags(driver) as Record<string, unknown>

    const updated = {
      ...omit(source, ...unset.map((k: string) => removeDriverFlagPrefix(driver, k))),
      ...extractDriverFlags(this.flags, driver, { excludeDefaultValues: false }),
    }

    await pStore.setDefaultFlags(driver, updated)

    ux.info(`Updated configuration for driver ${driver}:`)
    if (Object.keys(updated).length) {
      ux.styledObject(updated)
    } else {
      ux.info('(empty)')
    }
  }
}
