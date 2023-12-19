import { describe, test, expect, it } from '@jest/globals'
import { ScriptInjection, parseScriptInjectionLabels, scriptInjectionsToLabels } from './script-injection.js'

describe('script injection labels', () => {
  describe('parseScriptInjectionLabels', () => {
    test('should parse correctly a single label group', () => {
      const labels = {
        'preevy.inject_script.widget.src': 'https://my-script',
        'preevy.inject_script.widget.defer': 'true',
        'preevy.inject_script.widget.async': 'false',
        'preevy.inject_script.widget.path_regex': 't.*t',
        'preevy.inject_script.widget.port': '3000',
      }

      const [scripts, errors] = parseScriptInjectionLabels(labels)
      expect(errors).toHaveLength(0)
      expect(scripts).toHaveLength(1)
      expect(scripts[0]).toMatchObject({
        src: 'https://my-script',
        defer: true,
        async: false,
        pathRegex: expect.any(RegExp),
        port: 3000,
      })
      expect(scripts[0].pathRegex?.source).toBe('t.*t')
    })

    test('should ignore scripts with invalid regex', () => {
      const labels = {
        'preevy.inject_script.widget.src': 'https://my-script',
        'preevy.inject_script.widget.path_regex': '[',
      }
      const [scripts, errors] = parseScriptInjectionLabels(labels)
      expect(scripts).toHaveLength(0)
      expect(errors).toHaveLength(1)
    })

    test('should drop scripts without src', () => {
      const labels = {
        'preevy.inject_script.widget.defer': 'true',
      }
      const [scripts, errors] = parseScriptInjectionLabels(labels)
      expect(scripts).toHaveLength(0)
      expect(errors).toHaveLength(1)
    })

    test('should drop scripts with an invalid number as port', () => {
      const labels = {
        'preevy.inject_script.widget.src': 'https://my-script',
        'preevy.inject_script.widget.defer': 'true',
        'preevy.inject_script.widget.port': 'a',
      }
      const [scripts, errors] = parseScriptInjectionLabels(labels)
      expect(scripts).toHaveLength(0)
      expect(errors).toHaveLength(1)
    })

    test('should support multiple scripts', () => {
      const labels = {
        'preevy.inject_script.widget.src': 'https://my-script',
        'preevy.inject_script.widget.defer': '1',
        'preevy.inject_script.widget2.src': 'https://my-script2',
        'preevy.inject_script.widget2.defer': 'false',
        'preevy.inject_script.widget3.src': 'https://my-script3',
        'preevy.inject_script.widget3.defer': '0',
      }
      const [scripts, errors] = parseScriptInjectionLabels(labels)
      expect(errors).toHaveLength(0)
      expect(scripts).toHaveLength(3)
      expect(scripts).toContainEqual(
        {
          src: 'https://my-script',
          defer: true,
        },
      )
      expect(scripts).toContainEqual(
        {
          src: 'https://my-script2',
          defer: false,
        },
      )
      expect(scripts).toContainEqual(
        {
          src: 'https://my-script3',
          defer: false,
        },
      )
    })
  })

  describe('scriptInjectionsToLabels', () => {
    const injections: Record<string, ScriptInjection> = {
      script1: {
        src: 'https://my-script',
        defer: true,
        async: false,
        pathRegex: /^aaa/,
      },
      script2: {
        src: 'https://my-script2',
      },
    }

    it('should convert to labels', () => {
      expect(scriptInjectionsToLabels(injections)).toMatchObject({
        'preevy.inject_script.script1.src': 'https://my-script',
        'preevy.inject_script.script1.defer': 'true',
        'preevy.inject_script.script1.path_regex': '^aaa',
        'preevy.inject_script.script2.src': 'https://my-script2',
      })
    })
  })
})
