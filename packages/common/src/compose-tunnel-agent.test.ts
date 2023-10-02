/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, test, expect } from '@jest/globals'
import { scriptInjectionFromLabels } from './compose-tunnel-agent'

describe('parse script injection labels', () => {
  test('should parse correctly', () => {
    const labels = {
      'preevy.inject_script.widget.src': 'https://my-script',
      'preevy.inject_script.widget.defer': 'true',
      'preevy.inject_script.widget.async': 'false',
      'preevy.inject_script.widget.path_regex': 't.*t',
    }
    const scriptInjections = scriptInjectionFromLabels(labels)
    expect(scriptInjections).toHaveLength(1)
    const [script] = scriptInjections
    expect(script).toMatchObject({
      src: 'https://my-script',
      defer: true,
      async: false,
      pathRegex: expect.any(RegExp),
    })
  })
  test('should revive regex correctly', () => {
    const labels = {
      'preevy.inject_script.widget.src': 'https://my-script',
      'preevy.inject_script.widget.path_regex': 't.*t',
    }
    const [script] = scriptInjectionFromLabels(labels)
    expect('test').toMatch(script.pathRegex!)
    expect('best').not.toMatch(script.pathRegex!)
  })

  test('should ignore scripts with invalid regex', () => {
    const labels = {
      'preevy.inject_script.widget.src': 'https://my-script',
      'preevy.inject_script.widget.path_regex': '[',
    }
    expect(scriptInjectionFromLabels(labels)).toHaveLength(0)
  })

  test('should drop scripts without src', () => {
    const labels = {
      'preevy.inject_script.widget.defer': 'true',
    }
    expect(scriptInjectionFromLabels(labels)).toHaveLength(0)
  })

  test('should support multiple scripts', () => {
    const labels = {
      'preevy.inject_script.widget.src': 'https://my-script',
      'preevy.inject_script.widget2.src': 'https://my-script2',
      'preevy.inject_script.widget3.src': 'https://my-script3',
    }
    const scripts = scriptInjectionFromLabels(labels)
    expect(scripts).toHaveLength(3)
    expect(scripts).toMatchObject([
      {
        src: 'https://my-script',
      },
      {
        src: 'https://my-script2',
      },
      {
        src: 'https://my-script3',
      },
    ])
  })
})
