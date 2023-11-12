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

export const addScriptInjectionsToModel = (
  model: ComposeModel,
  factory: (serviceName: string, serviceDef: ComposeService) => Record<string, ScriptInjection> | undefined,
): ComposeModel => ({
  ...model,
  services: mapValues(model.services ?? {}, (def, name) => addScriptInjectionsToService(def, factory(name, def) ?? {})),
})
