import { describe, it, expect, beforeEach } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import { apiClient, registerTokenGetter } from './api.client'
import { DEVICE_ID_STORAGE_KEY } from '@/lib/device-id'

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear()
    registerTokenGetter(() => null)
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

    const mockConfig = { headers: {} } as unknown as InternalAxiosRequestConfig
    const result = await requestInterceptor.fulfilled(mockConfig)

    expect(result.headers['X-Device-Id']).toBe(testDeviceId)
  })

  it('should attach Authorization Bearer token from in-memory token getter', async () => {
    registerTokenGetter(() => 'test_in_memory_jwt_token')

    // @ts-expect-error accessing private axios interceptor handlers for test
    const requestInterceptor = apiClient.interceptors.request.handlers[0]
    const mockConfig = { headers: {} } as unknown as InternalAxiosRequestConfig
    const result = await requestInterceptor.fulfilled(mockConfig)

    expect(result.headers['Authorization']).toBe('Bearer test_in_memory_jwt_token')
  })
})
