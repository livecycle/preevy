import { describe, test, expect } from '@jest/globals'
import { ComposeModel } from './model'
import { scriptInjector } from './script-injection'

describe('script injection', () => {
  test('inject script to all services', async () => {
    const model:ComposeModel = {
      name: 'my-app',
      services: {
        frontend1: {},
        frontend2: {
          labels: {
            other: 'value',
          },
        },
      },
    }

  const injector = scriptInjector('test', { src: 'https://mydomain.com/myscript.ts', async: true, pathRegex: /.*/ })
    const newModel = injector.inject(model)
    expect(newModel.services?.frontend1?.labels).toMatchObject({ 'preevy.inject_script.test.src': 'https://mydomain.com/myscript.ts', 'preevy.inject_script.test.async': 'true', 'preevy.inject_script.test.path_regex': '.*' })
    expect(newModel.services?.frontend2?.labels).toMatchObject({ other: 'value', 'preevy.inject_script.test.src': 'https://mydomain.com/myscript.ts', 'preevy.inject_script.test.async': 'true', 'preevy.inject_script.test.path_regex': '.*' })
  })

  test('does not affect original model', async () => {
    const model:ComposeModel = {
      name: 'my-app',
      services: {
        frontend1: {},
        frontend2: {
          labels: {
            other: 'value',
          },
        },
      },
    }

    const injector = scriptInjector('test', { src: 'https://mydomain.com/myscript.ts' })
    const newModel = injector.inject(model)
    expect(model.services?.frontend1?.labels).toBeUndefined()
    expect(model.services?.frontend2?.labels).not
      .toMatchObject(newModel.services?.frontend2?.labels as Record<string, unknown>)
  })
})
