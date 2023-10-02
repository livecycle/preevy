import { ScriptInjection, sectionToLabels } from '@preevy/common'
import { ComposeModel, ComposeService } from './model'

export const addScript = (model: ComposeModel, service: string, { id, ...script } :
  {id: string} & ScriptInjection):ComposeModel => {
  const { services } = model
  if (!services || !(service in services)) {
    return model
  }
  const serviceDef = services[service]
  return {
    ...model,
    services: {
      ...model.services,
      [service]: {
        ...serviceDef,
        labels: {
          ...serviceDef.labels,
          ...sectionToLabels(`preevy.inject_script.${id}`, script),
        },
      },
    },
  }
}

export const scriptInjector = (id : string, script: ScriptInjection) => {
  const injectScript = (model:ComposeModel, service:string) => addScript(model, service, { id, ...script })
  const injectAll = (_serviceName:string, _def: ComposeService) => true
  return {
    inject: (model: ComposeModel, serviceFilter = injectAll) =>
      Object.keys(model.services ?? {})
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        .filter(s => serviceFilter(s, model.services![s]))
        .reduce(injectScript, model),
  }
}

export const widgetScriptInjector = (url:string) => scriptInjector('preevy-widget', { src: url })
