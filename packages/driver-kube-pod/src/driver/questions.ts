import * as inquirer from '@inquirer/prompts'
import { MachineCreationFlagTypes, flags } from './creation-driver.js'
import { loadKubeConfig } from './client/index.js'

export const inquireFlags = async (): Promise<Partial<MachineCreationFlagTypes>> => {
  const namespace = await inquirer.input({
    default: flags.namespace.default as string,
    message: flags.namespace.description as string,
  })

  const kc = loadKubeConfig() // will read from KUBECONFIG env var as well
  const contextChoices = [
    { name: 'Default: use default context at runtime', value: undefined },
    new inquirer.Separator(),
    ...kc.getContexts().map(c => ({ value: c.name })),
  ] as const

  const context = await inquirer.select({
    choices: contextChoices,
    message: flags.context.description as string,
  })

  return {
    ...(namespace && namespace !== flags.namespace.default) ? { namespace } : undefined,
    ...(context && context !== flags.context.default) ? { context } : undefined,
  }
}
