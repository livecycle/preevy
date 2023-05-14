import { GetOperationCommand, GetOperationCommandInput, LightsailClient, Operation as SdkOperation } from '@aws-sdk/client-lightsail'
import { checkExceptions, createWaiter, WaiterConfiguration, WaiterResult, WaiterState } from '@aws-sdk/util-waiter'
import { inspect } from 'util'
import { extractDefined } from '../../aws-utils/nulls'

type Operation = Pick<SdkOperation, 'id'>

const checkState = async (client: LightsailClient, input: GetOperationCommandInput): Promise<WaiterResult> => {
  try {
    const operation = await extractDefined(client.send(new GetOperationCommand(input)), 'operation')
    if (operation.status && ['Succeeded', 'Completed'].includes(operation.status)) {
      return { state: WaiterState.SUCCESS, reason: operation }
    }
    if (operation.status === 'Failed') {
      return { state: WaiterState.FAILURE, reason: operation }
    }
    return { state: WaiterState.RETRY, reason: operation }
  } catch (exception) {
    return { state: WaiterState.FAILURE, reason: exception }
  }
}

const waitDefaults = { maxDelay: 5, minDelay: 1 }

const extractOperationId = (o: string | { id?: string } | { operation?: Operation }): string => {
  if (typeof o === 'string') {
    return o
  }
  if ('operation' in o && typeof o.operation === 'object') {
    return extractDefined(o.operation, 'id')
  }
  if ('id' in o && typeof o.id === 'string') {
    return o.id
  }
  throw new Error(`No operation id in ${inspect(o)}`)
}

export const waitUntilOperationSucceeds = async (
  config: WaiterConfiguration<LightsailClient>,
  operationOrId: string | { id?: string } | { operation?: Operation },
) => checkExceptions(await createWaiter(
  { ...waitDefaults, ...config },
  { operationId: extractOperationId(operationOrId) },
  checkState,
))

type MaybePromise<T> = Promise<T> | T
const isPromiseLike = <T>(v: unknown): v is PromiseLike<T> => Boolean(v) && typeof (v as { then: unknown }).then === 'function'
const makePromiseLike = <T>(v: PromiseLike<T> | T): PromiseLike<T> => (isPromiseLike(v) ? v : Promise.resolve(v))

type OperationsOrCommandResult = Operation[]
    | Operation
    | MaybePromise<{ operations?: Operation[] }>
    | MaybePromise<{ operation?: Operation }>

const normalizeOperations = async (operationsOrcommand: OperationsOrCommandResult): Promise<Operation[]> => {
  const p = await makePromiseLike(operationsOrcommand)

  if ('operations' in p) {
    return p.operations ?? []
  }
  if ('operation' in p) {
    return p.operation ? [p.operation] : []
  }
  if (Array.isArray(operationsOrcommand)) {
    return p as Operation[]
  }
  return (p ? [p] : []) as Operation[]
}

export async function waitUntilAllOperationsSucceed(
  config: WaiterConfiguration<LightsailClient>,
  operationsOrcommand: OperationsOrCommandResult,
): Promise<void> {
  const operations = await normalizeOperations(operationsOrcommand)
  await Promise.all(operations.map(operation => waitUntilOperationSucceeds(config, extractDefined(operation, 'id'))))
}
