import { flags, factory } from './driver.js'
import { flags as machineCreationFlags, factory as machineCreationFactory } from './creation-driver.js'
import { inquireFlags } from './questions.js'
import type {} from '@preevy/core' // https://github.com/microsoft/TypeScript/issues/47663#issuecomment-1270716220

export type { StatefulSetMachine, DeploymentMachine, ResourceType } from './common.js'
export type { MachineCreationFlagTypes } from './creation-driver.js'

export default {
  flags,
  factory,
  machineCreationFlags,
  machineCreationFactory,
  inquireFlags,
} as const
