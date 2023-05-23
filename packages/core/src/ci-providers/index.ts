import { azurePipelinesCiProvider } from './azure-pipelines'
import { CiProvider } from './base'
import { circleCiProvider } from './circle'
import { githubActionsCiProvider } from './github-actions'
import { gitlabActionsCiProvider } from './gitlab'
import { travisCiProvider } from './travis'

export const ciProviders = {
  githubActions: githubActionsCiProvider(),
  gitlabActions: gitlabActionsCiProvider(),
  travis: travisCiProvider(),
  circle: circleCiProvider(),
  azurePipelines: azurePipelinesCiProvider(),
}

export const detectCiProvider = (): CiProvider | undefined => Object.values(ciProviders)
  .find(p => p.currentlyRunningInProvider())
