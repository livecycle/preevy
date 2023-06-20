import { flags, factory } from './machine-driver'
import { flags as machineCreationFlags, factory as machineCreationFactory } from './machine-creation-driver'
import { flagsFromAnswers, questions } from './questions'

export default {
  flags,
  factory,
  machineCreationFlags,
  machineCreationFactory,
  questions,
  flagsFromAnswers,
} as const
