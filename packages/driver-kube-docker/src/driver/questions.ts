import { InputQuestion, ListQuestion, ConfirmQuestion } from 'inquirer'
import { MachineCreationFlagTypes, flags } from './creation-driver'

export const questions = async (): Promise<(InputQuestion | ListQuestion | ConfirmQuestion)[]> => [
  {
    type: 'input',
    name: 'namespace',
    default: flags.namespace.default,
    message: flags.namespace.description,
  },
  {
    type: 'input',
    name: 'kubeconfig',
    default: flags.kubeconfig.default,
    message: flags.kubeconfig.description,
  },
  {
    type: 'input',
    name: 'template',
    default: flags.template.default,
    message: flags.template.description,
  },
  {
    type: 'confirm',
    name: 'server-side-apply',
    message: 'Use server-side apply?',
    default: flags['server-side-apply'].default,
  },
]

export const flagsFromAnswers = async (
  answers: Record<string, unknown>,
): Promise<Partial<MachineCreationFlagTypes>> => {
  const result = {
    ...(answers.namespace && answers.namespace !== flags.namespace.default)
      ? { namespace: answers.namespace as string } : undefined,
    ...(answers.kubeconfig && answers.kubeconfig !== flags.kubeconfig.default)
      ? { kubeconfig: answers.kubeconfig as string } : undefined,
    ...(answers.template && answers.template !== flags.template.default)
      ? { template: answers.template as string } : undefined,
    ...(answers['server-side-apply'] !== flags['server-side-apply'].default)
      ? { 'server-side-apply': answers['server-side-apply'] as boolean } : undefined,
  }
  console.log('flagsFromAnswers', answers, flags, result)
  return result
}
