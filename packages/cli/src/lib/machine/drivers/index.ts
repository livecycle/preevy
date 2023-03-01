import util from 'util'
import { driverRelationship } from '../driver/flags'
import lightsail from './lightsail'
import fake from './fake'
import { filter, flatMap, map } from 'lodash'
import { Flags } from '@oclif/core'
import { Relationship } from '@oclif/core/lib/interfaces/parser'

export const machineDrivers = {
  lightsail,
  fake,
} as const

type MachineDrivers = typeof machineDrivers
export type DriverName = keyof MachineDrivers

type DriverFlagName<Name extends DriverName> = keyof MachineDrivers[Name]['flags'] extends string ? keyof MachineDrivers[Name]['flags'] : never
type DriverFlag<Name extends DriverName, FlagName extends DriverFlagName<Name>> = MachineDrivers[Name]['flags'][FlagName]

type DriverFlags<Name extends DriverName> = {
  [P in DriverFlagName<Name> as `${Name}-${P}`]: DriverFlag<Name, P>
}

export const driverFlags = <Name extends DriverName>(driverName: Name) => Object.assign({}, ...map(
  machineDrivers[driverName].flags,
  <FlagName extends DriverFlagName<Name>>(flag: DriverFlag<Name, FlagName>, flagName: FlagName) => ({
    [`${driverName}-${flagName}`]: {
      ...flag,
      required: false,
    }
  })
)) as DriverFlags<Name>

export const allDriverFlags = {
  ...driverFlags('lightsail'),
  ...driverFlags('fake'),
}

export const driverRelationships = (driverFlagName = 'driver'): Relationship[] => [
  { 
    type: 'all', 
    flags: flatMap(
      machineDrivers, 
      ({ flags }, driverName) => Object.entries(flags).filter(([, { required }]) => required)
      .map(([flagName, { name }]) => ({ 
        name: `${driverName}-${name ?? flagName}`, 
        when: async flags => flags[driverFlagName] === driverName,
      })),
    )
  }
]
