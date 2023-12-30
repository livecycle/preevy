import { flags, factory } from './driver.js'
import { flags as machineCreationFlags, factory as machineCreationFactory } from './creation-driver.js'
import { inquireFlags } from './questions.js'

export type { DeploymentMachine, ResourceType } from './common.js'
export type { MachineCreationFlagTypes } from './creation-driver.js'

export default {
  flags,
  factory,
  machineCreationFlags,
  machineCreationFactory,
  inquireFlags,
} as const
