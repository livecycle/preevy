import { map, mapKeys } from 'lodash'
import lightsail from '@preevy/driver-lightsail'
import gce from '@preevy/driver-gce'
import azure from '@preevy/driver-azure'
import kubeDocker from '@preevy/driver-kube-pod'
import { Flag } from '@oclif/core/lib/interfaces'
import { Interfaces } from '@oclif/core'

export const machineDrivers = {
  lightsail,
  gce,
  azure,
  'kube-pod': kubeDocker,
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
  ...driverFlags('kube-pod'),
}

export const machineCreationflagsForAllDrivers = {
  ...machineCreationDriverFlags('lightsail'),
  ...machineCreationDriverFlags('gce'),
  ...machineCreationDriverFlags('azure'),
  ...machineCreationDriverFlags('kube-pod'),
}

export const stripDriverFlagNamePrefix = (driverName:string, flag: string) => flag.replace(`${driverName}-`, '')

export const removeDriverPrefix = <T extends {}>(
  driverName: string,
  flags: Record<string, unknown>,
) => mapKeys(flags, (_, key) => stripDriverFlagNamePrefix(driverName, key) as unknown as T)

export const excludeDefaultFlags = (
  driverFlagDefs: Record<string, Flag<unknown>>,
) => ([key, value]: [string, unknown]) => value !== (
  (driverFlagDefs as Record<string, Flag<unknown>>)[key]
)?.default

type AllFlags = typeof flagsForAllDrivers & typeof machineCreationflagsForAllDrivers

export function extractConfigurableFlags<TFlags extends Partial<AllFlags>>(
  flags: Interfaces.InferredFlags<TFlags>,
  driver: DriverName,
  options: {
    excludeDefaultValues: boolean
  } = { excludeDefaultValues: true }
) {
  const driverStatic = machineDrivers[driver]
  const allDriverFlags = {
    ...driverStatic.flags,
    ...driverStatic.machineCreationFlags,
  } as Record<string, Flag<unknown>>
  const defaultFlagsFilter = options.excludeDefaultValues ? excludeDefaultFlags(allDriverFlags) : () => true

  const driverPrefix = `${driver}-`
  return Object.fromEntries(Object.entries(flags)
    .filter(([k]) => k.startsWith(driverPrefix))
    .map(([k, v]) => [k.substring(driverPrefix.length), v])
    .filter(([k, v]) => defaultFlagsFilter([k as string, v])))
}
