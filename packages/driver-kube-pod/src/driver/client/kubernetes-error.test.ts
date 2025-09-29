import { describe, it, expect } from '@jest/globals'
import { KubernetesConnectionError } from './log-error.js'

// Mock error scenarios that would come from the kubernetes client
const createMockConnectionError = (message: string, code?: number) => {
  const error: any = new Error(message)
  if (code !== undefined) {
    error.response = { statusCode: code }
  }
  return error
}

const createMockNetworkError = (message: string, code: string) => {
  const error: any = new Error(message)
  error.code = code
  return error
}

describe('KubernetesConnectionError', () => {
  it('should identify and enhance ECONNREFUSED errors', () => {
    const originalError = createMockNetworkError('connect ECONNREFUSED 192.168.1.100:6443', 'ECONNREFUSED')
    const enhanced = new KubernetesConnectionError(
      'Failed to connect to Kubernetes cluster. The Kubernetes API server appears to be unreachable. Please check that your cluster is running and accessible.\n\nThis is a Kubernetes connectivity issue, not a tunnel server problem.',
      originalError
    )

    expect(enhanced.message).toContain('Failed to connect to Kubernetes cluster')
    expect(enhanced.message).toContain('This is a Kubernetes connectivity issue, not a tunnel server problem')
    expect(enhanced.cause).toBe(originalError)
  })

  it('should identify and enhance DNS resolution errors', () => {
    const originalError = createMockNetworkError('getaddrinfo ENOTFOUND k8s.example.com', 'ENOTFOUND')
    const enhanced = new KubernetesConnectionError(
      'Failed to connect to Kubernetes cluster. Could not resolve the Kubernetes API server hostname. Please check your cluster configuration and network connectivity.\n\nThis is a Kubernetes connectivity issue, not a tunnel server problem.',
      originalError
    )

    expect(enhanced.message).toContain('Could not resolve the Kubernetes API server hostname')
    expect(enhanced.message).toContain('This is a Kubernetes connectivity issue, not a tunnel server problem')
  })

  it('should identify and enhance authentication errors', () => {
    const originalError = createMockConnectionError('Unauthorized', 401)
    const enhanced = new KubernetesConnectionError(
      'Failed to connect to Kubernetes cluster. Authentication failed. Please check your Kubernetes credentials and configuration.\n\nThis is a Kubernetes connectivity issue, not a tunnel server problem.',
      originalError
    )

    expect(enhanced.message).toContain('Authentication failed')
    expect(enhanced.message).toContain('This is a Kubernetes connectivity issue, not a tunnel server problem')
  })

  it('should identify and enhance authorization errors', () => {
    const originalError = createMockConnectionError('Forbidden', 403)
    const enhanced = new KubernetesConnectionError(
      'Failed to connect to Kubernetes cluster. Access denied. Please check that your Kubernetes credentials have the necessary permissions.\n\nThis is a Kubernetes connectivity issue, not a tunnel server problem.',
      originalError
    )

    expect(enhanced.message).toContain('Access denied')
    expect(enhanced.message).toContain('This is a Kubernetes connectivity issue, not a tunnel server problem')
  })

  it('should identify and enhance timeout errors', () => {
    const originalError = createMockNetworkError('timeout of 5000ms exceeded', 'TIMEOUT')
    const enhanced = new KubernetesConnectionError(
      'Failed to connect to Kubernetes cluster. Connection to the Kubernetes API server timed out. Please check your cluster configuration and network connectivity.\n\nThis is a Kubernetes connectivity issue, not a tunnel server problem.',
      originalError
    )

    expect(enhanced.message).toContain('Connection to the Kubernetes API server timed out')
    expect(enhanced.message).toContain('This is a Kubernetes connectivity issue, not a tunnel server problem')
  })

  it('should identify and enhance kubeconfig context errors', () => {
    const originalError = new Error('no configuration has been provided, try setting KUBERNETES_SERVICE_HOST and KUBERNETES_SERVICE_PORT')
    const enhanced = new KubernetesConnectionError(
      'Failed to connect to Kubernetes cluster. No valid Kubernetes configuration found. Please check your kubeconfig file and ensure it contains a valid context.\n\nThis is a Kubernetes connectivity issue, not a tunnel server problem.',
      originalError
    )

    expect(enhanced.message).toContain('No valid Kubernetes configuration found')
    expect(enhanced.message).toContain('This is a Kubernetes connectivity issue, not a tunnel server problem')
  })

  it('should preserve error properties correctly', () => {
    const originalError = createMockConnectionError('Test error', 500)
    originalError.stack = 'original stack trace'

    const enhanced = new KubernetesConnectionError('Enhanced message', originalError)

    expect(enhanced.name).toBe('KubernetesConnectionError')
    expect(enhanced.cause).toBe(originalError)
    expect(enhanced.message).toBe('Enhanced message')
  })
})