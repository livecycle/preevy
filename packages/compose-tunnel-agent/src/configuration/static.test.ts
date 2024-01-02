import fs from 'fs'
import yaml from 'yaml'
import { describe, it, expect, beforeEach, afterEach, test, jest, beforeAll, afterAll } from '@jest/globals'
import path from 'path'
import { rimraf } from 'rimraf'
import { PartialConfig } from './schema.js'
import { ParseResult, mergedConfig } from './static.js'

const setupEnv = (env: Record<string, string | undefined>) => {
  const varsToDelete: string[] = []
  const oldEnv: Record<string, string | undefined> = {}
  beforeEach(() => {
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
    expect((result as { output: string }).output).toContain('Missing required arguments')
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
    const result = await mergedConfig('--ssh-url ssh://host --env-id my-env-id --ssh-private-key "BEGIN "')
    expect(result).not.toHaveProperty('error')
    expect(result).toHaveProperty('result')
    expect((result as { result: PartialConfig }).result).toMatchObject({
      sshUrl: {
        hostname: 'host',
        isTls: false,
        port: 22,
      },
      envId: 'my-env-id',
      sshPrivateKey: 'BEGIN ',
    })
  })

  describe('bare essentials from env', () => {
    setupEnv({
      CTA_SSH_URL: 'ssh://host-from-env',
      CTA_ENV_ID: 'my-env-id',
      CTA_SSH_PRIVATE_KEY: 'BEGIN ',
    })
    test('from env', async () => {
      const result = await mergedConfig('--ssh-url ssh://host')
      expect(result).not.toHaveProperty('error')
      expect(result).toHaveProperty('result')
      expect((result as { result: PartialConfig }).result).toMatchObject({
        sshUrl: {
          hostname: 'host',
          isTls: false,
          port: 22,
        },
        envId: 'my-env-id',
        sshPrivateKey: 'BEGIN ',
      })
    })
  })

  test('not enough arguments', async () => {
    const result = await mergedConfig('--env-id my-env-id --ssh-private-key "BEGIN "')
    expect(result).toHaveProperty('error')
    expect((result as { error: Error }).error).toBeDefined()
    expect((result as { output: string }).output).toContain('Missing required argument: ssh-url')
    expect((result as { output: string }).output).toContain('--version')
  })

  describe('global injects arg', () => {
    test('single', async () => {
      const config = await mergedConfig('--ssh-url ssh://host --env-id my-env-id --ssh-private-key "BEGIN " --global-injects.widget.src http://my-widget/widget')
      expect(config).not.toHaveProperty('error')
      expect(config).toHaveProperty('result')
      expect((config as { result: PartialConfig }).result).toMatchObject({
        globalInjects: [
          {
            src: 'http://my-widget/widget',
          },
        ],
      })
    })

    test('multiple', async () => {
      const result = await mergedConfig('--ssh-url ssh://host --env-id my-env-id --ssh-private-key "BEGIN " --global-injects.widget.src http://my-widget/widget --global-injects.2.src http://my-widget/widget-2 --global-injects.2.async true')
      expect(result).not.toHaveProperty('error')
      expect(result).toHaveProperty('result')
      expect((result as { result: PartialConfig }).result).toMatchObject({
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

      let config: ParseResult<PartialConfig>
      beforeEach(async () => {
        config = await mergedConfig('--ssh-url ssh://host --env-id my-env-id --ssh-private-key "BEGIN " --global-injects.widget.src http://my-widget/widget')
      })

      it('should succeed', () => {
        expect(config).not.toHaveProperty('error')
      })

      it('should parse correctly', () => {
        expect((config as { result: PartialConfig }).result).toMatchObject({
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
      let config: ParseResult<PartialConfig>
      beforeEach(async () => {
        const configFile = tempFile(JSON.stringify({
          globalInjects: {
            widget2: {
              src: 'http://my-widget/widget-2',
              async: true,
              port: 3000,
            },
          },
        }))

        config = await mergedConfig(`--ssh-url ssh://host --env-id my-env-id --ssh-private-key "BEGIN " --global-injects.widget.src http://my-widget/widget --config ${configFile}`)
      })

      it('should succeed', () => {
        expect(config).not.toHaveProperty('error')
      })

      it('should parse correctly', () => {
        expect((config as { result: PartialConfig }).result).toMatchObject({
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

      let config: ParseResult<PartialConfig>
      beforeEach(async () => {
        const configFile = tempFile(JSON.stringify({
          globalInjects: {
            widget2: {
              src: 'http://my-widget/widget-2',
            },
          },
        }))

        config = await mergedConfig(`--ssh-url ssh://host --env-id my-env-id --ssh-private-key "BEGIN " --global-injects.widget.src http://my-widget/widget --config ${configFile}`)
      })

      it('should succeed', () => {
        expect(config).not.toHaveProperty('error')
      })

      it('should parse correctly', () => {
        expect((config as { result: PartialConfig }).result).toMatchObject({
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

          let config: ParseResult<PartialConfig>
          beforeEach(async () => {
            const configFile = tempFile(JSON.stringify({
              globalInjects: {
                widget2: {
                  src: 'http://my-widget/widget-2',
                },
              },
            }))

            let argv = `--ssh-url ssh://host --env-id my-env-id --ssh-private-key "BEGIN " --global-injects.widget.src http://my-widget/widget --config ${configFile} --printConfig`
            if (printConfigVal) {
              argv += ` ${printConfigVal}`
            }
            config = await mergedConfig(argv)
          })

          it('should succeed', () => {
            expect(config).not.toHaveProperty('error')
          })

          it('should output json', () => {
            const parser: typeof JSON.parse = printConfigVal === 'yaml' ? yaml.parse : JSON.parse
            const actual = parser((config as { output: string }).output)
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
  })
})
