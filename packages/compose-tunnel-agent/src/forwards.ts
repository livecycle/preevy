import { IEventEmitter } from 'tseep'
import { ScriptInjection } from '@preevy/common'

export type Forward<Meta = {}> = {
  host: string
  port: number
  externalName: string
  meta: Meta
  access: 'private' | 'public'
  injects: ScriptInjection[]
}

export type ForwardsEvents = {
  forwards: (forwards: Forward[]) => void
}

export type ForwardsEmitter = AsyncDisposable & IEventEmitter<ForwardsEvents>
