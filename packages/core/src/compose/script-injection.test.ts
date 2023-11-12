import { describe, expect, jest, beforeEach, it } from '@jest/globals'
import { ScriptInjection } from '@preevy/common'
import { ComposeModel } from './model'
import { addScriptInjectionsToModel } from './script-injection'

describe('addScriptInjectionsToModel', () => {
  const model: ComposeModel = Object.freeze({
    name: 'my-app',
    services: {
      frontend1: {},
      frontend2: {
        labels: {
          other: 'value',
        },
      },
      frontend3: {},
    },
  })

  let callback: jest.MockedFunction<(name: string) => Record<string, ScriptInjection> | undefined>
  let newModel: ComposeModel

  const injection: ScriptInjection = {
    src: 'https://mydomain.com/myscript.ts',
    async: true,
    pathRegex: /.*/,
  }

  beforeEach(() => {
    callback = jest.fn(name => (['frontend1', 'frontend2'].includes(name) ? ({ test: injection }) : undefined))
    newModel = addScriptInjectionsToModel(model, callback)
  })

  it('injects the script for the first two services', () => {
    const expectedLabels = {
      'preevy.inject_script.test.src': 'https://mydomain.com/myscript.ts',
      'preevy.inject_script.test.async': 'true',
      'preevy.inject_script.test.path_regex': '.*',
    }
    expect(newModel.services?.frontend1?.labels).toMatchObject(expectedLabels)
    expect(newModel.services?.frontend2?.labels).toMatchObject({ other: 'value', ...expectedLabels })
  })

  it('does not inject the script for the last service', () => {
    expect(newModel.services?.frontend3?.labels).toMatchObject({})
  })

  it('calls the factory correctly', () => {
    expect(callback).toHaveBeenCalledTimes(3)
    expect(callback).toHaveBeenCalledWith('frontend1', {})
    expect(callback).toHaveBeenCalledWith('frontend2', { labels: { other: 'value' } })
  })

  it('does not affect original model', () => {
    expect(newModel).not.toBe(model)
  })
})
