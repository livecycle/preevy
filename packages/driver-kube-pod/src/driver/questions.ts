import * as inquirer from '@inquirer/prompts'
import * as k8s from '@kubernetes/client-node'
import { Logger, withSpinner } from '@preevy/core'
import { asyncToArray } from 'iter-tools-es'
import { MachineCreationFlagTypes, flags } from './creation-driver.js'
import { extractName, loadKubeConfig } from './client/index.js'
import { storageV1ApiHelpers as createStorageV1ApiHelpers } from './client/k8s-helpers.js'
import { logError } from './client/log-error.js'

export const inquireStorageClass = async (kc: k8s.KubeConfig, { log }: { log: Logger }) => {
  const wrap = logError(log)
  const storageHelpers = createStorageV1ApiHelpers(kc.makeApiClient(k8s.StorageV1Api), { wrap })
  const availableStorageClasses = await withSpinner(
    () => asyncToArray(storageHelpers.listStorageClasses({ })),
    { text: 'Loading storage classes...' },
  )

  if (!availableStorageClasses.length) {
    return undefined
  }
  const storageClassNames = availableStorageClasses.map(extractName)
  return await inquirer.select({
    message: flags['storage-class'].description as string,
    choices: [{ name: '(default)', value: undefined }, new inquirer.Separator(), ...storageClassNames.map(c => ({ value: c }))],
    default: undefined,
  })
}

export const inquireFlags = async ({ log }: { log: Logger }): Promise<Partial<MachineCreationFlagTypes>> => {
  const namespace = await inquirer.input({
    default: flags.namespace.default as string,
    message: flags.namespace.description as string,
  })

  const kc = loadKubeConfig({}) // will read from KUBECONFIG env var as well
  const contextChoices = [
    { name: 'Default: use default context at runtime', value: undefined },
    new inquirer.Separator(),
    ...kc.getContexts().map(c => ({ value: c.name })),
  ] as const

  const context = await inquirer.select({
    choices: contextChoices,
    message: flags.context.description as string,
  })

  const storageClass = await inquireStorageClass(kc, { log })

  const storageSize = Number(await inquirer.input({
    message: flags['storage-size'].description as string,
    default: String(flags['storage-size'].default),
    validate: value => (Number(value) > 0 ? true : 'Please enter a positive number'),
  }))

  return {
    ...(namespace && namespace !== flags.namespace.default) ? { namespace } : undefined,
    ...(context && context !== flags.context.default) ? { context } : undefined,
    ...(storageClass && storageClass !== flags['storage-class'].default) ? { 'storage-class': storageClass } : undefined,
    ...(storageSize && storageSize !== flags['storage-size'].default) ? { 'storage-size': storageSize } : undefined,
  }
}
