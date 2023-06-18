import { CiProvider } from './base'
import { stringOrUndefinedToNumber } from './common'

// https://learn.microsoft.com/en-us/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml
export const azurePipelinesCiProvider = (): CiProvider => ({
  name: 'Azure Pipelines',
  telemetryId: 'azurepipelines',
  currentlyRunningInProvider: () => Boolean(process.env.BUILD_DEFINITIONNAME),
  branchName: () => process.env.BUILD_SOURCEBRANCHNAME,
  pullRequestNumber: () => stringOrUndefinedToNumber(
    process.env.SYSTEM_PULLREQUEST_PULLREQUESTNUMBER || process.env.SYSTEM_PULLREQUEST_PULLREQUESTID,
  ),
  repoUrl: () => process.env.BUILD_REPOSITORYURI,
})
