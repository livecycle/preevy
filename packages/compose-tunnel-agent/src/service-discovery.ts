import { IEventEmitter } from 'tseep'
import { ScriptInjection } from '@preevy/common'

export type RunningService = {
  project: string
  name: string
  ports: number[]
  access: 'private' | 'public'
  inject: ScriptInjection[]
}

export type ServiceDiscovery = IEventEmitter<{
  servicesUpdated: (services: RunningService[]) => void
}>
