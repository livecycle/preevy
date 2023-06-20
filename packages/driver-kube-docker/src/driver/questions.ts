import { InputQuestion, ListQuestion, CheckboxQuestion } from 'inquirer'
import { MachineCreationFlagTypes, flags } from './machine-creation-driver'

export const questions = async (): Promise<(InputQuestion | ListQuestion | CheckboxQuestion)[]> => [
  {
    type: 'input',
    name: 'namespace',
    default: flags.namespace.default,
    message: flags.namespace.description,
  },
  {
    type: 'input',
    name: 'kubeconfig',
    message: flags.kubeconfig.description,
  },
  {
    type: 'input',
    name: 'template',
    message: flags.template.description,
  },
  {
    type: 'checkbox',
    name: 'serverSideApply',
    message: flags.template.description,
  },
]

export const flagsFromAnswers = async (answers: Record<string, unknown>): Promise<MachineCreationFlagTypes> => ({
  namespace: answers.namespace as string,
  kubeconfig: answers.kubeconfig as string,
  template: answers.template as string,
  'server-side-apply': answers.serverSideApply as boolean,
})
