import { azurePipelinesCiProvider } from './azure-pipelines'
import { CiProvider } from './base'
import { circleCiProvider } from './circle'
import { githubActionsCiProvider } from './github-actions'
import { gitlabActionsCiProvider } from './gitlab'
import { travisCiProvider } from './travis'

const providersInOrder = [
  githubActionsCiProvider(),
  gitlabActionsCiProvider(),
  travisCiProvider(),
  circleCiProvider(),
  azurePipelinesCiProvider(),
] as const

export const detectCiProvider = (): CiProvider | undefined => providersInOrder.find(p => p.currentlyRunningInProvider())
