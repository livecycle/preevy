import { ScriptInjection, scriptInjectionsToLabels } from '@preevy/common'
import { mapValues } from 'lodash'
import { ComposeModel, ComposeService } from './model'

const addScriptInjectionsToService = (
  service: ComposeService,
  injections: Record<string, ScriptInjection>,
): ComposeService => ({
  ...service,
  labels: {
    ...service.labels,
    ...scriptInjectionsToLabels(injections),
  },
})

export const addScriptInjectionsToServices = (
  services: ComposeModel['services'],
  factory: (serviceName: string, serviceDef: ComposeService) => Record<string, ScriptInjection> | undefined,
): ComposeModel['services'] => mapValues(services, (def, name) => addScriptInjectionsToService(def, factory(name, def) ?? {}))
