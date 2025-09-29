import { describe, it, expect } from '@jest/globals'
import { serviceLinkEnvVars } from './service-links.js'

describe('serviceLinkEnvVars', () => {
  const mockServiceUrls = [
    { name: 'frontend', port: 3000, url: 'https://frontend-3000-env123-client456.livecycle.run/' },
    { name: 'api', port: 8080, url: 'https://api-8080-env123-client456.livecycle.run/' },
    { name: 'my-service', port: 9000, url: 'https://my-service-9000-env123-client456.livecycle.run/' },
  ]

  describe('backward compatibility', () => {
    it('should generate PREEVY_BASE_URI variables for each service and port', () => {
      const result = serviceLinkEnvVars(mockServiceUrls)

      expect(result).toMatchObject({
        'PREEVY_BASE_URI_FRONTEND_3000': 'https://frontend-3000-env123-client456.livecycle.run/',
        'PREEVY_BASE_URI_API_8080': 'https://api-8080-env123-client456.livecycle.run/',
        'PREEVY_BASE_URI_MY_SERVICE_9000': 'https://my-service-9000-env123-client456.livecycle.run/',
      })
    })

    it('should normalize service names with non-alphanumeric characters', () => {
      const serviceUrls = [
        { name: 'my-service-name', port: 3000, url: 'https://example.com/' },
        { name: 'service.with.dots', port: 8080, url: 'https://example.com/' },
      ]

      const result = serviceLinkEnvVars(serviceUrls)

      expect(result).toMatchObject({
        'PREEVY_BASE_URI_MY_SERVICE_NAME_3000': 'https://example.com/',
        'PREEVY_BASE_URI_SERVICE_WITH_DOTS_8080': 'https://example.com/',
      })
    })
  })

  describe('new environment variables', () => {
    it('should generate PREEVY_HOST variables with just the hostname', () => {
      const result = serviceLinkEnvVars(mockServiceUrls)

      expect(result).toMatchObject({
        'PREEVY_HOST_FRONTEND_3000': 'frontend-3000-env123-client456.livecycle.run',
        'PREEVY_HOST_API_8080': 'api-8080-env123-client456.livecycle.run',
        'PREEVY_HOST_MY_SERVICE_9000': 'my-service-9000-env123-client456.livecycle.run',
      })
    })

    it('should include PREEVY_ENV_ID when envId is provided', () => {
      const result = serviceLinkEnvVars(mockServiceUrls, 'test-env-123')

      expect(result).toMatchObject({
        'PREEVY_ENV_ID': 'test-env-123',
      })
    })

    it('should not include PREEVY_ENV_ID when envId is not provided', () => {
      const result = serviceLinkEnvVars(mockServiceUrls)

      expect(result).not.toHaveProperty('PREEVY_ENV_ID')
    })

    it('should handle invalid URLs gracefully for host extraction', () => {
      const serviceUrls = [
        { name: 'valid', port: 3000, url: 'https://valid.example.com/' },
        { name: 'invalid', port: 8080, url: 'not-a-url' },
      ]

      const result = serviceLinkEnvVars(serviceUrls)

      expect(result).toMatchObject({
        'PREEVY_BASE_URI_VALID_3000': 'https://valid.example.com/',
        'PREEVY_BASE_URI_INVALID_8080': 'not-a-url',
        'PREEVY_HOST_VALID_3000': 'valid.example.com',
        'PREEVY_HOST_INVALID_8080': '', // Falls back to empty string for invalid URLs
      })
    })
  })

  describe('complete environment variable generation', () => {
    it('should generate all expected environment variables when envId is provided', () => {
      const result = serviceLinkEnvVars(mockServiceUrls, 'test-env-123')

      // Verify all PREEVY_BASE_URI variables
      expect(result['PREEVY_BASE_URI_FRONTEND_3000']).toBe('https://frontend-3000-env123-client456.livecycle.run/')
      expect(result['PREEVY_BASE_URI_API_8080']).toBe('https://api-8080-env123-client456.livecycle.run/')
      expect(result['PREEVY_BASE_URI_MY_SERVICE_9000']).toBe('https://my-service-9000-env123-client456.livecycle.run/')

      // Verify all PREEVY_HOST variables
      expect(result['PREEVY_HOST_FRONTEND_3000']).toBe('frontend-3000-env123-client456.livecycle.run')
      expect(result['PREEVY_HOST_API_8080']).toBe('api-8080-env123-client456.livecycle.run')
      expect(result['PREEVY_HOST_MY_SERVICE_9000']).toBe('my-service-9000-env123-client456.livecycle.run')

      // Verify PREEVY_ENV_ID
      expect(result['PREEVY_ENV_ID']).toBe('test-env-123')

      // Verify the total number of variables
      expect(Object.keys(result)).toHaveLength(7) // 3 BASE_URI + 3 HOST + 1 ENV_ID
    })
  })
})