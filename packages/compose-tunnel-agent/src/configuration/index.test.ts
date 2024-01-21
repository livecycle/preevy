import fs from 'fs'
import yaml from 'yaml'
import { describe, it, expect, beforeEach, afterEach, test, beforeAll, afterAll } from '@jest/globals'
import path from 'path'
import { rimraf } from 'rimraf'
import { Config, ConfigParseResult, mergedConfig as mc } from './index.js'
import { PluginOpts, pluginFactories } from '../plugins/index.js'
import { Opts } from './opts.js'
import { PluginFactory } from '../plugin-definition.js'

const mergedConfig = (argv: string[] | string) => mc(
  pluginFactories as unknown as Record<string, PluginFactory<Opts & PluginOpts>>,
  argv,
) as Promise<ConfigParseResult<PluginOpts>>

type Env = Record<string, string | undefined>
const setupEnv = (envOrEnvFactory: Env | (() => Env | Promise<Env>)) => {
  const varsToDelete: string[] = []
  const oldEnv: Record<string, string | undefined> = {}
  beforeEach(async () => {
    const env = typeof envOrEnvFactory === 'function' ? await envOrEnvFactory() : envOrEnvFactory
    Object.entries(env).forEach(([key, value]) => {
      if (key in process.env) {
        oldEnv[key] = process.env[key]
      } else {
        varsToDelete.push(key)
      }
      process.env[key] = value
    })
  })
  afterEach(() => {
    Object.assign(process.env, oldEnv)
    varsToDelete.forEach(key => delete process.env[key])
  })
}

const setupTempDir = () => {
  let dirPath: string
  beforeAll(async () => {
    dirPath = path.join(await fs.promises.mkdtemp('test-'))
  })
  afterAll(async () => {
    await rimraf(dirPath)
  })
  return {
    file: async (content: string, extension = '') => {
      const filename = [path.join(dirPath, Math.random().toString(36).substring(2, 9)), extension].filter(Boolean).join('.')
      await fs.promises.writeFile(filename, content)
      return filename
    },
  }
}

describe('static configuration', () => {
  const { file: tempFile } = setupTempDir()

  test('no args', async () => {
    const result = await mergedConfig('')
    expect(result).toHaveProperty('error')
    expect((result as { output: string }).output).toContain('Missing required argument')
  })

  test('--help', async () => {
    const result = await mergedConfig('--help')
    expect(result).not.toHaveProperty('error')
    expect((result as { output: string }).output).toContain('--version')
  })

  test('--version', async () => {
    const result = await mergedConfig('--version')
    expect(result).not.toHaveProperty('error')
    expect((result as { output: string }).output).toMatch(/^\d+\.\d+\.\d+$/)
  })

  test('bare essentials', async () => {
    const result = await mergedConfig('--env-id my-env-id')
    expect(result).not.toHaveProperty('error')
    expect(result).toHaveProperty('result')
    expect((result as { result: Config }).result).toMatchObject({
      server: 'ssh+tls://livecycle.run',
      envId: 'my-env-id',
    })
  })

  describe('bare essentials from env', () => {
    setupEnv({
      CTA_SERVER: 'ssh://host-from-env',
      CTA_ENV_ID: 'my-env-id',
      CTA_PRIVATE_KEY: 'BEGIN ',
    })
    test('from env', async () => {
      const result = await mergedConfig('')
      expect(result).not.toHaveProperty('error')
      expect(result).toHaveProperty('result')
      expect((result as { result: Config }).result).toMatchObject({
        server: 'ssh://host-from-env',
        envId: 'my-env-id',
        privateKey: 'BEGIN ',
      })
    })
  })

  test('not enough arguments', async () => {
    const result = await mergedConfig('')
    expect(result).toHaveProperty('error')
    expect((result as { error: Error }).error).toBeDefined()
    expect((result as { output: string }).output).toContain('Missing required argument: env-id')
    expect((result as { output: string }).output).toContain('--version')
  })

  describe('global injects arg', () => {
    test('single', async () => {
      const pr = await mergedConfig('--env-id my-env-id --global-injects.widget.src http://my-widget/widget')
      expect(pr).not.toHaveProperty('error')
      expect(pr).toHaveProperty('result')
      expect((pr as { result: Config }).result).toMatchObject({
        globalInjects: [
          {
            src: 'http://my-widget/widget',
          },
        ],
      })
    })

    test('multiple', async () => {
      const pr = await mergedConfig('--env-id my-env-id --global-injects.widget.src http://my-widget/widget --global-injects.2.src http://my-widget/widget-2 --global-injects.2.async true')
      expect(pr).not.toHaveProperty('error')
      expect(pr).toHaveProperty('result')
      expect((pr as { result: Config }).result).toMatchObject({
        globalInjects: expect.arrayContaining([
          {
            src: 'http://my-widget/widget',
          },
          {
            src: 'http://my-widget/widget-2',
            async: true,
          },
        ]),
      })
    })

    describe('from env', () => {
      setupEnv({
        CTA_GLOBAL_INJECTS__WIDGET2__SRC: 'http://my-widget/widget-2',
        CTA_GLOBAL_INJECTS__WIDGET2__ASYNC: '1',
        CTA_GLOBAL_INJECTS__WIDGET2__PORT: '3000',
      })

      let pr: ConfigParseResult
      beforeEach(async () => {
        pr = await mergedConfig('--env-id my-env-id --global-injects.widget.src http://my-widget/widget')
      })

      it('should succeed', () => {
        expect(pr).not.toHaveProperty('error')
      })

      it('should parse correctly', () => {
        expect((pr as { result: Config }).result).toMatchObject({
          globalInjects: expect.arrayContaining([
            {
              src: 'http://my-widget/widget',
            },
            {
              src: 'http://my-widget/widget-2',
              async: true,
              port: 3000,
            },
          ]),
        })
      })
    })

    describe('from config file', () => {
      let pr: ConfigParseResult
      beforeEach(async () => {
        const configFile = await tempFile(JSON.stringify({
          globalInjects: {
            widget2: {
              src: 'http://my-widget/widget-2',
              async: true,
              port: 3000,
            },
          },
        }))

        pr = await mergedConfig(`--env-id my-env-id --global-injects.widget.src http://my-widget/widget --config ${configFile}`)
      })

      it('should succeed', () => {
        expect(pr).not.toHaveProperty('error')
      })

      it('should parse correctly', () => {
        expect((pr as { result: Config }).result).toMatchObject({
          globalInjects: expect.arrayContaining([
            {
              src: 'http://my-widget/widget',
            },
            {
              src: 'http://my-widget/widget-2',
              async: true,
              port: 3000,
            },
          ]),
        })
      })
    })

    describe('from config file and env', () => {
      setupEnv({
        CTA_GLOBAL_INJECTS__WIDGET3__SRC: 'http://my-widget/widget-3',
        CTA_GLOBAL_INJECTS__WIDGET3__ASYNC: '1',
        CTA_GLOBAL_INJECTS__WIDGET3__PORT: '3000',
      })

      let pr: ConfigParseResult
      beforeEach(async () => {
        const configFile = await tempFile(JSON.stringify({
          globalInjects: {
            widget2: {
              src: 'http://my-widget/widget-2',
            },
          },
        }))

        pr = await mergedConfig(`--env-id my-env-id --global-injects.widget.src http://my-widget/widget --config ${configFile}`)
      })

      it('should succeed', () => {
        expect(pr).not.toHaveProperty('error')
      })

      it('should parse correctly', () => {
        expect((pr as { result: Config }).result).toMatchObject({
          globalInjects: expect.arrayContaining([
            {
              src: 'http://my-widget/widget',
            },
            {
              src: 'http://my-widget/widget-2',
            },
            {
              src: 'http://my-widget/widget-3',
              async: true,
              port: 3000,
            },
          ]),
        })
      })
    })

    describe('print config from config file and env', () => {
      const testWith = (printConfigVal?: 'json' | 'yaml') => {
        describe(`with ${printConfigVal ?? 'default'}`, () => {
          setupEnv({
            CTA_GLOBAL_INJECTS__WIDGET3__SRC: 'http://my-widget/widget-3',
            CTA_GLOBAL_INJECTS__WIDGET3__ASYNC: '1',
            CTA_GLOBAL_INJECTS__WIDGET3__PORT: '3000',
          })

          let pr: ConfigParseResult
          beforeEach(async () => {
            const configFile = await tempFile(JSON.stringify({
              globalInjects: {
                widget2: {
                  src: 'http://my-widget/widget-2',
                },
              },
            }))

            let argv = `--env-id my-env-id --global-injects.widget.src http://my-widget/widget --config ${configFile} --printConfig`
            if (printConfigVal) {
              argv += ` ${printConfigVal}`
            }
            pr = await mergedConfig(argv)
          })

          it('should succeed', () => {
            expect(pr).not.toHaveProperty('error')
          })

          it('should output json', () => {
            const parser: typeof JSON.parse = printConfigVal === 'yaml' ? yaml.parse : JSON.parse
            const actual = parser((pr as { output: string }).output)
            expect(actual).toMatchObject({
              globalInjects: expect.arrayContaining([
                {
                  src: 'http://my-widget/widget',
                },
                {
                  src: 'http://my-widget/widget-2',
                },
                {
                  src: 'http://my-widget/widget-3',
                  async: true,
                  port: 3000,
                },
              ]),
            })
          })
        })
      }

      testWith()
      testWith('json')
      testWith('yaml')
    })

    describe('plugins', () => {
      let pr: ConfigParseResult
      beforeEach(async () => {
        pr = await mergedConfig('--env-id my-env-id --plugin docker-compose')
      })

      it('should check required flags', () => {
        expect(pr).toHaveProperty('error')
        expect((pr as { output: string }).output).toContain('Missing required argument')
      })
    })

    describe('multiple config files in a single option', () => {
      const config1 = {
        envId: 'my-env-id',
        envMetadata: {
          key3: 'value3',
        },
      }
      const config2 = {
        server: 'ssh://my-server',
        envMetadata: {
          ar: ['value2'],
          key2: 'override-value',
        },
      }
      setupEnv(async () => ({
        CTA_CONFIG: `${await tempFile(JSON.stringify(config1))},${await tempFile(yaml.stringify(config2), 'yaml')}`,
        CTA_ENV_METADATA: '{"ar": ["value1"], "key2": "value2"}',
      }))
      let pr: ConfigParseResult
      beforeEach(async () => {
        pr = await mergedConfig('')
      })

      it('should read from both config files', () => {
        expect(pr).not.toHaveProperty('error')
        expect((pr as { result: Config }).result).toMatchObject({
          server: 'ssh://my-server',
          envId: 'my-env-id',
          envMetadata: {
            ar: expect.arrayContaining(['value1', 'value2']),
            key2: 'override-value',
            key3: 'value3',
          },
        })
      })
    })
  })
})
