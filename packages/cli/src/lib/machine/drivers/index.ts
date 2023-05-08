import { map } from 'lodash'
import lightsail from './lightsail'
import gce from './gce'
import fake from './fake'

export const machineDrivers = {
  lightsail,
  gce,
  fake,
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
  ...driverFlags('fake'),
}

export const machineCreationflagsForAllDrivers = {
  ...machineCreationDriverFlags('lightsail'),
  ...machineCreationDriverFlags('gce'),
  ...machineCreationDriverFlags('fake'),
}
