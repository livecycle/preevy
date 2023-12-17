import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { ImageRegistry, generateBuild, parseRegistry } from './index.js'
import { ComposeModel, ComposeService } from '../compose/index.js'
import { ImageTagCalculator } from './image-tag.js'
import { mockFunction } from '../test-helpers.js'

describe('build', () => {
  const ECR_BASE_REGISTRY = '123456789.dkr.ecr.us-east-1.amazonaws.com'
  const ECR_REPO = 'my-repo'
  const ECR_REPO2 = 'my-repo2'

  describe('parseRegistry', () => {
    describe('when given an ECR-style registry', () => {
      const REGISTRY = `${ECR_BASE_REGISTRY}/${ECR_REPO}`

      describe('when given singleName=false', () => {
        let result: ImageRegistry

        beforeEach(() => {
          result = parseRegistry({ registry: REGISTRY, singleName: false })
        })
        it('should not return a singleName', () => {
          expect(result).toEqual({ registry: REGISTRY })
        })
      })

      describe('when given singleName=string', () => {
        let result: ImageRegistry

        beforeEach(() => {
          result = parseRegistry({ registry: REGISTRY, singleName: ECR_REPO2 })
        })
        it('should return the given singleName', () => {
          expect(result).toEqual({ registry: REGISTRY, singleName: ECR_REPO2 })
        })
      })

      describe('when given singleName=undefined', () => {
        let result: ImageRegistry

        beforeEach(() => {
          result = parseRegistry({ registry: REGISTRY, singleName: undefined })
        })
        it('should auto-detect the singleName', () => {
          expect(result).toEqual({ registry: ECR_BASE_REGISTRY, singleName: ECR_REPO })
        })
      })
    })

    describe('when given an non-ECR-style registry', () => {
      const REGISTRY = 'my-registry'

      describe('when given singleName=false', () => {
        let result: ImageRegistry

        beforeEach(() => {
          result = parseRegistry({ registry: REGISTRY, singleName: false })
        })
        it('should not return a singleName', () => {
          expect(result).toEqual({ registry: REGISTRY })
        })
      })

      describe('when given singleName=string', () => {
        let result: ImageRegistry

        beforeEach(() => {
          result = parseRegistry({ registry: REGISTRY, singleName: ECR_REPO2 })
        })
        it('should return the given singleName', () => {
          expect(result).toEqual({ registry: REGISTRY, singleName: ECR_REPO2 })
        })
      })

      describe('when given singleName=undefined', () => {
        let result: ImageRegistry

        beforeEach(() => {
          result = parseRegistry({ registry: REGISTRY, singleName: undefined })
        })
        it('should not return a singleName', () => {
          expect(result).toEqual({ registry: REGISTRY })
        })
      })
    })
  })

  describe('generateBuild', () => {
    let result: Awaited<ReturnType<typeof generateBuild>>
    let bakeArgs: string[]

    let mockTagCalculator: jest.MockedFunction<ImageTagCalculator>
    beforeEach(() => {
      mockTagCalculator = mockFunction<ImageTagCalculator>(async () => 'abcdef')
    })

    describe('sanity', () => {
      beforeEach(async () => {
        result = await generateBuild({
          imageTagCalculator: mockTagCalculator,
          composeModel: {
            name: 'my-project',
            services: {
              frontend: {
                build: {
                  context: '/context',
                  dockerfile: 'x/Dockerfile',
                  target: 'dev',
                },
                environment: {
                  FOO: 'bar',
                },
              },
              db: {
                image: 'mydb',
              },
            },
          },
          buildSpec: {
            builder: 'my-builder',
            cacheFromRegistry: true,
            noCache: false,
            registry: { registry: 'my-registry' },
          },
          machineDockerPlatform: 'linux/amd64',
        })

        bakeArgs = result.createBakeArgs('my-file.yaml')
      })

      it('should return a correct build model', () => {
        expect(result.buildModel).toEqual({
          name: 'my-project',
          services: {
            frontend: {
              build: {
                context: '/context',
                dockerfile: 'x/Dockerfile',
                target: 'dev',
                cache_from: [
                  'my-registry/preevy-my-project-frontend:latest',
                  'my-registry/preevy-my-project-frontend:abcdef',
                ],
                cache_to: [
                  'type=registry,ref=my-registry/preevy-my-project-frontend:latest,mode=max,oci-mediatypes=true,image-manifest=true',
                ],
                tags: [
                  'my-registry/preevy-my-project-frontend:latest',
                  'my-registry/preevy-my-project-frontend:abcdef',
                ],
              },
              image: 'my-registry/preevy-my-project-frontend:abcdef',
            },
          },
        } as ComposeModel)
      })

      it('should return the correct bake args', () => {
        expect(bakeArgs).toEqual([
          '-f', 'my-file.yaml',
          '--push',
          '--builder=my-builder',
          '--set=*.platform=linux/amd64',
        ])
      })

      it('should transform the deploy model correctly', () => {
        expect(result.deployModel).toEqual({
          name: 'my-project',
          services: {
            frontend: {
              build: {
                context: '/context',
                dockerfile: 'x/Dockerfile',
                target: 'dev',
              },
              image: 'my-registry/preevy-my-project-frontend:abcdef',
              environment: {
                FOO: 'bar',
              },
            },
            db: {
              image: 'mydb',
            },
          },
        } as ComposeModel)
      })
    })

    describe('ECR-style registry', () => {
      beforeEach(async () => {
        result = await generateBuild({
          imageTagCalculator: mockTagCalculator,
          composeModel: {
            name: 'my-project',
            services: {
              frontend: {
                build: {
                  context: '/context',
                  dockerfile_inline: 'bla',
                  target: 'dev',
                },
                environment: {
                  FOO: 'bar',
                },
              },
              db: {
                image: 'mydb',
              },
            },
          },
          buildSpec: {
            builder: 'my-builder',
            cacheFromRegistry: true,
            noCache: false,
            registry: { registry: 'my-registry', singleName: 'my-repo' },
          },
          machineDockerPlatform: 'linux/amd64',
        })
      })

      it('should return a correct build model', () => {
        expect(result.buildModel.services?.frontend).toMatchObject({
          build: {
            cache_from: [
              'my-registry/my-repo:preevy-my-project-frontend-latest',
              'my-registry/my-repo:preevy-my-project-frontend-abcdef',
            ],
            cache_to: [
              'type=registry,ref=my-registry/my-repo:preevy-my-project-frontend-latest,mode=max,oci-mediatypes=true,image-manifest=true',
            ],
            tags: [
              'my-registry/my-repo:preevy-my-project-frontend-latest',
              'my-registry/my-repo:preevy-my-project-frontend-abcdef',
            ],
          },
          image: 'my-registry/my-repo:preevy-my-project-frontend-abcdef',
        } as ComposeService)
      })

      it('should transform the deploy model correctly', () => {
        expect(result.deployModel.services?.frontend).toMatchObject({
          image: 'my-registry/my-repo:preevy-my-project-frontend-abcdef',
        })
      })
    })

    describe('when no registry is given', () => {
      beforeEach(async () => {
        result = await generateBuild({
          imageTagCalculator: mockTagCalculator,
          composeModel: {
            name: 'my-project',
            services: {
              frontend: {
                build: {
                  context: '/context',
                  dockerfile: 'x/Dockerfile',
                  target: 'dev',
                },
                environment: {
                  FOO: 'bar',
                },
              },
              db: {
                image: 'mydb',
              },
            },
          },
          buildSpec: {
            builder: 'my-builder',
            cacheFromRegistry: true,
            noCache: false,
            registry: undefined,
          },
          machineDockerPlatform: 'linux/amd64',
        })

        bakeArgs = result.createBakeArgs('my-file.yaml')
      })

      it('should return a correct build model', () => {
        expect(result.buildModel.services?.frontend).toMatchObject({
          build: {
            tags: [
              'preevy-my-project-frontend:latest',
              'preevy-my-project-frontend:abcdef',
            ],
          },
          image: 'preevy-my-project-frontend:abcdef',
        } as ComposeService)
      })

      it('should transform the deploy model correctly', () => {
        expect(result.deployModel.services?.frontend).toMatchObject({
          image: 'preevy-my-project-frontend:abcdef',
        })
      })

      it('should return the correct bake args', () => {
        expect(bakeArgs).toContain('--load')
        expect(bakeArgs).not.toContain('--push')
      })
    })

    describe('when buildSpec.cacheFromRegistry=false and an image is given', () => {
      beforeEach(async () => {
        result = await generateBuild({
          imageTagCalculator: mockTagCalculator,
          composeModel: {
            name: 'my-project',
            services: {
              frontend: {
                build: {
                  context: '/context',
                  dockerfile: 'x/Dockerfile',
                  target: 'dev',
                  cache_from: ['cf1', 'cf2'],
                  cache_to: ['ct1'],
                },
                environment: {
                  FOO: 'bar',
                },
                image: 'my-frontend',
              },
              db: {
                image: 'mydb',
              },
            },
          },
          buildSpec: {
            builder: 'my-builder',
            cacheFromRegistry: false,
            noCache: false,
            registry: { registry: 'my-registry' },
          },
          machineDockerPlatform: 'linux/amd64',
        })

        bakeArgs = result.createBakeArgs('my-file.yaml')
      })

      it('should return a correct build model', () => {
        expect(result.buildModel.services?.frontend).toMatchObject({
          build: {
            context: '/context',
            dockerfile: 'x/Dockerfile',
            target: 'dev',
            tags: [
              'my-registry/preevy-my-project-frontend:latest',
              'my-registry/preevy-my-project-frontend:abcdef',
            ],
            cache_from: ['cf1', 'cf2'],
            cache_to: ['ct1'],
          },
          image: 'my-frontend',
        })
      })
    })
  })
})
