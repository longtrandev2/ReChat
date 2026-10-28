import { describe, it, expect, beforeEach } from 'vitest'
import { apiClient } from './api.client'
import { DEVICE_ID_STORAGE_KEY } from '@/lib/device-id'

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should have withCredentials enabled for HttpOnly cookies', () => {
    expect(apiClient.defaults.withCredentials).toBe(true)
  })

  it('should attach X-Device-Id from LocalStorage via request interceptor', async () => {
    const testDeviceId = 'device-uuid-9999-test'
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, testDeviceId)

    // @ts-expect-error accessing private axios interceptor handlers for test
    const requestInterceptor = apiClient.interceptors.request.handlers[0]
    expect(requestInterceptor).toBeDefined()

    const mockConfig = { headers: {} as Record<string, string> }
    const result = await requestInterceptor.fulfilled(mockConfig as any)

    expect(result.headers['X-Device-Id']).toBe(testDeviceId)
  })

  it('should attach Authorization Bearer token if available in LocalStorage', async () => {
    localStorage.setItem('rechat_access_token', 'test_jwt_access_token')

    // @ts-expect-error accessing private axios interceptor handlers for test
    const requestInterceptor = apiClient.interceptors.request.handlers[0]
    const mockConfig = { headers: {} as Record<string, string> }
    const result = await requestInterceptor.fulfilled(mockConfig as any)

    expect(result.headers['Authorization']).toBe('Bearer test_jwt_access_token')
  })
})
