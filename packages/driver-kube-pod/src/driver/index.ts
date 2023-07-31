import { flags, factory } from './driver'
import { flags as machineCreationFlags, factory as machineCreationFactory } from './creation-driver'
import { flagsFromAnswers, questions } from './questions'

export default {
  flags,
  factory,
  machineCreationFlags,
  machineCreationFactory,
  questions,
  flagsFromAnswers,
} as const
