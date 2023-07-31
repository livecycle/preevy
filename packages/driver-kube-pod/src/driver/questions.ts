import { InputQuestion, ListQuestion, ConfirmQuestion } from 'inquirer'
import { MachineCreationFlagTypes, flags } from './creation-driver'
import { loadKubeConfig } from './client'

export const questions = async (): Promise<(InputQuestion | ListQuestion | ConfirmQuestion)[]> => [
  {
    type: 'input',
    name: 'namespace',
    default: flags.namespace.default,
    message: flags.namespace.description,
  },
  {
    type: 'list',
    name: 'context',
    choices: () => {
      const kc = loadKubeConfig() // will read from KUBECONFIG env var as well
      return kc.getContexts().map(c => c.name)
    },
    default: () => {
      const kc = loadKubeConfig() // will read from KUBECONFIG env var as well
      return kc.getCurrentContext()
    },
    message: flags.context.description,
  },
]

export const flagsFromAnswers = async (
  answers: Record<string, unknown>,
): Promise<Partial<MachineCreationFlagTypes>> => {
  const result = {
    ...(answers.namespace && answers.namespace !== flags.namespace.default)
      ? { namespace: answers.namespace as string } : undefined,
    ...(answers.context && answers.context !== flags.context.default)
      ? { context: answers.context as string } : undefined,
  }
  return result
}
