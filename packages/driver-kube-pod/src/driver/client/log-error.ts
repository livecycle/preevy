import { HttpError } from '@kubernetes/client-node'
import { Logger } from '@preevy/core'
import { inspect } from 'util'

export class KubernetesConnectionError extends Error {
  constructor(message: string, public readonly cause: Error) {
    super(message)
    this.name = 'KubernetesConnectionError'
  }
}

const isConnectionError = (error: any): boolean => {
  if (!error) return false

  const message = error.message?.toLowerCase() || ''
  const code = error.code || error.response?.statusCode

  // Common kubernetes connection error patterns
  return (
    // Network connection errors
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('timeout') ||
    message.includes('network is unreachable') ||
    // Kubernetes API server connection errors
    message.includes('unable to connect to the server') ||
    message.includes('connection refused') ||
    // Authentication/authorization errors (likely config issues)
    code === 401 || code === 403 ||
    // Kubernetes config/context errors
    message.includes('current-context') ||
    message.includes('no configuration has been provided') ||
    message.includes('unable to load in-cluster configuration')
  )
}

const enhanceKubernetesError = (error: any): Error => {
  if (isConnectionError(error)) {
    const message = error.message?.toLowerCase() || ''

    let userFriendlyMessage = 'Failed to connect to Kubernetes cluster. '

    if (message.includes('econnrefused') || message.includes('connection refused')) {
      userFriendlyMessage += 'The Kubernetes API server appears to be unreachable. Please check that your cluster is running and accessible.'
    } else if (message.includes('enotfound') || message.includes('network is unreachable')) {
      userFriendlyMessage += 'Could not resolve the Kubernetes API server hostname. Please check your cluster configuration and network connectivity.'
    } else if (message.includes('timeout')) {
      userFriendlyMessage += 'Connection to the Kubernetes API server timed out. Please check your cluster configuration and network connectivity.'
    } else if (error.response?.statusCode === 401) {
      userFriendlyMessage += 'Authentication failed. Please check your Kubernetes credentials and configuration.'
    } else if (error.response?.statusCode === 403) {
      userFriendlyMessage += 'Access denied. Please check that your Kubernetes credentials have the necessary permissions.'
    } else if (message.includes('current-context') || message.includes('no configuration has been provided')) {
      userFriendlyMessage += 'No valid Kubernetes configuration found. Please check your kubeconfig file and ensure it contains a valid context.'
    } else {
      userFriendlyMessage += 'Please check your Kubernetes cluster configuration and connectivity.'
    }

    userFriendlyMessage += '\n\nThis is a Kubernetes connectivity issue, not a tunnel server problem.'

    return new KubernetesConnectionError(userFriendlyMessage, error)
  }

  return error
}

export const logError = (log: Logger) => <
  Args extends unknown[],
  ReturnType
>(
  f: (...args: Args) => Promise<ReturnType>
) => async (...args: Args): Promise<ReturnType> => {
  try {
    return await f(...args)
  } catch (e) {
    if (e instanceof HttpError) {
      log.error(`Kubernetes API Response: ${inspect(e.body)}`)
    }

    const enhancedError = enhanceKubernetesError(e)
    throw enhancedError
  }
}

export type FuncWrapper = <
  Args extends unknown[],
  ReturnType
>(f: (...args: Args) => Promise<ReturnType>) => (...args: Args) => Promise<ReturnType>
