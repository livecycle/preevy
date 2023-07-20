import { profileStore } from '@preevy/core'
import { Flags, ux } from '@oclif/core'
import { Flag } from '@oclif/core/lib/interfaces'
import { isEqual, mapValues, pickBy } from 'lodash'
import {
  stripDriverFlagNamePrefix,
  extractConfigurableFlags,
  flagsForAllDrivers,
  machineCreationflagsForAllDrivers,
  DriverName,
  machineDrivers,
} from '../../../drivers'
import ProfileCommand from '../../../profile-command'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const removeDefaultFlagsDef = <T extends {[key: string]: Flag<any> } >(flags: T): T =>
  mapValues(flags, v => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { default: _, ...newV } = v
    return newV
  }) as T

// eslint-disable-next-line no-use-before-define
export default class UpdateProfileConfig extends ProfileCommand<typeof UpdateProfileConfig> {
  static description = 'View and update profile configuration'

  static flags = {
    ...removeDefaultFlagsDef({
      ...flagsForAllDrivers,
      ...machineCreationflagsForAllDrivers,
    }),
    unset: Flags.string({
      description: 'Unset a configuration option',
      required: false,
      multiple: true,
    }),
  }

  static strict = false

  static enableJsonFlag = true

  async run(): Promise<void> {
    const pStore = profileStore(this.store)
    const driver = this.profile.driver as DriverName
    const origin = await pStore.defaultFlags(driver)
    let updated = origin
    if (this.flags.unset) {
      const allowedFlags = { ...machineDrivers[driver].flags, ...machineDrivers[driver].machineCreationFlags }
      const stripped = (this.flags.unset ?? []).map(prefix => stripDriverFlagNamePrefix(driver, prefix))
      for (const k of stripped) {
        if (!(k in allowedFlags)) {
          ux.error(`No such configuration option ${k}`, { exit: 1 })
        }
        // won't happen in practice, but we should address required flags in the future
        if ((allowedFlags[k as keyof typeof allowedFlags] as Flag<unknown>).required) {
          ux.error(`Cannot unset required configuration option ${k}`, { exit: 1 })
          return
        }
      }
      const prefixRemover = (k:string) => stripDriverFlagNamePrefix(driver, k)
      updated = pickBy(updated, (_, k) => !this.flags.unset?.map(prefixRemover).includes(k))
    }
    updated = { ...updated, ...extractConfigurableFlags(this.flags, driver, { excludeDefaultValues: false }) }
    if (!isEqual(origin, updated)) {
      await pStore.setDefaultFlags(driver, updated)
      ux.info('Updated profile configuration')
    }
    ux.info(`Current configuration for ${driver}:`)
    ux.styledObject(updated)
  }
}
