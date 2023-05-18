import { map, mapKeys } from 'lodash'
import { lightsail } from '@preevy/driver-lightsail'
import { gce } from '@preevy/driver-gce'
import { azure } from '@preevy/driver-azure'

export const machineDrivers = {
  lightsail,
  gce,
  azure,
} as const

type MachineDrivers = typeof machineDrivers

export type DriverName = keyof MachineDrivers

type FlagType = 'flags' | 'machineCreationFlags'

export type DriverFlagName<
  Name extends DriverName,
  Type extends FlagType,
> = keyof MachineDrivers[Name][Type] extends string ? keyof MachineDrivers[Name][Type] : never

export type DriverFlag<
  Name extends DriverName,
  Type extends FlagType,
  FlagName extends DriverFlagName<Name, Type>,
> = MachineDrivers[Name][Type][FlagName]

export type DriverFlags<Name extends DriverName, Type extends FlagType> = {
  [P in DriverFlagName<Name, Type> as `${Name}-${P}`]: DriverFlag<Name, Type, P>
}

const toOuterFlag = <Name extends DriverName, Type extends FlagType>(
  driverName: Name,
  flags: FlagType,
) => Object.assign({}, ...map(
  machineDrivers[driverName][flags],
  <FlagName extends DriverFlagName<Name, Type>>(flag: DriverFlag<Name, Type, FlagName>, flagName: FlagName) => ({
    [`${driverName}-${flagName}`]: {
      ...flag,
      helpGroup: `${driverName} driver`,
      required: false,
    },
  })
)) as DriverFlags<Name, Type>

export const driverFlags = <Name extends DriverName>(driverName: Name) => toOuterFlag(driverName, 'flags')

export const machineCreationDriverFlags = <Name extends DriverName>(driverName: Name) => toOuterFlag(driverName, 'machineCreationFlags')

export const flagsForAllDrivers = {
  ...driverFlags('lightsail'),
  ...driverFlags('gce'),
  ...driverFlags('azure'),
}

export const machineCreationflagsForAllDrivers = {
  ...machineCreationDriverFlags('lightsail'),
  ...machineCreationDriverFlags('gce'),
  ...machineCreationDriverFlags('azure'),
}

export const removeDriverPrefix = <T extends {}>(
  driverName: string,
  flags: Record<string, unknown>,
) => mapKeys(flags, (_, key) => key.replace(`${driverName}-`, '')) as unknown as T
