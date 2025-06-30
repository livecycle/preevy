import { azurePipelinesCiProvider } from './azure-pipelines.js'
import { CiProvider } from './base.js'
import { circleCiProvider } from './circle.js'
import { githubActionsCiProvider } from './github-actions.js'
import { gitlabActionsCiProvider } from './gitlab.js'
import { travisCiProvider } from './travis.js'
import { bitbucketPipelinesCiProvider } from './bitbucket-pipelines.js'

export const ciProviders = {
  githubActions: githubActionsCiProvider(),
  gitlabActions: gitlabActionsCiProvider(),
  travis: travisCiProvider(),
  circle: circleCiProvider(),
  azurePipelines: azurePipelinesCiProvider(),
  bitbucketPipelines: bitbucketPipelinesCiProvider()
}

export const detectCiProvider = (): CiProvider | undefined => Object.values(ciProviders)
  .find(p => p.currentlyRunningInProvider())

export { CiProvider } from './base.js'
