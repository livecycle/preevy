import { ContainerScriptInjection, scriptInjectionsToLabels } from '@preevy/common'
import { mapValues } from 'lodash-es'
import { ComposeModel, ComposeService } from './model.js'

const addScriptInjectionsToService = (
  service: ComposeService,
  injections: Record<string, ContainerScriptInjection>,
): ComposeService => ({
  ...service,
  labels: {
    ...service.labels,
    ...scriptInjectionsToLabels(injections),
  },
})

export const addScriptInjectionsToServices = (
  services: ComposeModel['services'],
  factory: (serviceName: string, serviceDef: ComposeService) => Record<string, ContainerScriptInjection> | undefined,
): ComposeModel['services'] => mapValues(services, (def, name) => addScriptInjectionsToService(def, factory(name, def) ?? {}))
