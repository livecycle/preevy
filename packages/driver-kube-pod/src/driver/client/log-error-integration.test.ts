import { describe, it, expect } from '@jest/globals'
import { logError } from './log-error.js'

// Mock logger
const mockLogger = {
  error: (message?: string, ...args: unknown[]) => console.log('LOG ERROR:', message, ...args),
  warn: (message?: string, ...args: unknown[]) => console.log('LOG WARN:', message, ...args),
  info: (message?: string, ...args: unknown[]) => console.log('LOG INFO:', message, ...args),
  debug: (message?: string, ...args: unknown[]) => console.log('LOG DEBUG:', message, ...args),
}

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

describe('logError function enhancement', () => {
  it('should enhance ECONNREFUSED errors with clear kubernetes messaging', async () => {
    const mockFunction = async () => {
      throw createMockNetworkError('connect ECONNREFUSED 192.168.1.100:6443', 'ECONNREFUSED')
    }

    const wrappedFunction = logError(mockLogger)(mockFunction)

    await expect(wrappedFunction()).rejects.toThrow(/Failed to connect to Kubernetes cluster/)
    await expect(wrappedFunction()).rejects.toThrow(/This is a Kubernetes connectivity issue, not a tunnel server problem/)
  })

  it('should enhance DNS resolution errors with helpful guidance', async () => {
    const mockFunction = async () => {
      throw createMockNetworkError('getaddrinfo ENOTFOUND k8s.example.com', 'ENOTFOUND')
    }

    const wrappedFunction = logError(mockLogger)(mockFunction)

    await expect(wrappedFunction()).rejects.toThrow(/Could not resolve the Kubernetes API server hostname/)
    await expect(wrappedFunction()).rejects.toThrow(/This is a Kubernetes connectivity issue, not a tunnel server problem/)
  })

  it('should enhance authentication errors with credential guidance', async () => {
    const mockFunction = async () => {
      throw createMockConnectionError('Unauthorized', 401)
    }

    const wrappedFunction = logError(mockLogger)(mockFunction)

    await expect(wrappedFunction()).rejects.toThrow(/Authentication failed/)
    await expect(wrappedFunction()).rejects.toThrow(/This is a Kubernetes connectivity issue, not a tunnel server problem/)
  })

  it('should enhance authorization errors with permission guidance', async () => {
    const mockFunction = async () => {
      throw createMockConnectionError('Forbidden', 403)
    }

    const wrappedFunction = logError(mockLogger)(mockFunction)

    await expect(wrappedFunction()).rejects.toThrow(/Access denied/)
    await expect(wrappedFunction()).rejects.toThrow(/This is a Kubernetes connectivity issue, not a tunnel server problem/)
  })

  it('should enhance timeout errors with connectivity guidance', async () => {
    const mockFunction = async () => {
      throw createMockNetworkError('timeout of 5000ms exceeded', 'TIMEOUT')
    }

    const wrappedFunction = logError(mockLogger)(mockFunction)

    await expect(wrappedFunction()).rejects.toThrow(/Connection to the Kubernetes API server timed out/)
    await expect(wrappedFunction()).rejects.toThrow(/This is a Kubernetes connectivity issue, not a tunnel server problem/)
  })

  it('should enhance configuration errors with kubeconfig guidance', async () => {
    const mockFunction = async () => {
      throw new Error('no configuration has been provided, try setting KUBERNETES_SERVICE_HOST and KUBERNETES_SERVICE_PORT')
    }

    const wrappedFunction = logError(mockLogger)(mockFunction)

    await expect(wrappedFunction()).rejects.toThrow(/No valid Kubernetes configuration found/)
    await expect(wrappedFunction()).rejects.toThrow(/This is a Kubernetes connectivity issue, not a tunnel server problem/)
  })

  it('should pass through non-connection errors unchanged', async () => {
    const originalError = new Error('Some other kubernetes error')
    const mockFunction = async () => {
      throw originalError
    }

    const wrappedFunction = logError(mockLogger)(mockFunction)

    await expect(wrappedFunction()).rejects.toBe(originalError)
  })

  it('should return successful results unchanged', async () => {
    const expectedResult = { success: true, data: 'test' }
    const mockFunction = async () => expectedResult

    const wrappedFunction = logError(mockLogger)(mockFunction)

    await expect(wrappedFunction()).resolves.toBe(expectedResult)
  })
})
