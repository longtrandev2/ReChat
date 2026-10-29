import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  AxiosHeaders,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios'
import {
  apiClient,
  registerTokenGetter,
  registerAuthRefreshHandler,
  registerAuthResetHandler,
  type CustomAxiosRequestConfig,
} from './api.client'
import { DEVICE_ID_STORAGE_KEY } from '@/lib/device-id'

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear()
    registerTokenGetter(() => null)
    registerAuthRefreshHandler(async () => null)
    registerAuthResetHandler(() => {})
    vi.clearAllMocks()
  })

  const getResponseInterceptor = () => {
    // @ts-expect-error accessing private axios interceptor handlers for test
    const handler = apiClient.interceptors.response.handlers[0]
    expect(handler).toBeDefined()
    expect(handler?.fulfilled).toBeDefined()
    expect(handler?.rejected).toBeDefined()
    return {
      fulfilled: handler!.fulfilled!,
      rejected: handler!.rejected!,
    }
  }

  describe('Configuration & Request Interceptors', () => {
    it('should have withCredentials enabled for HttpOnly cookies', () => {
      expect(apiClient.defaults.withCredentials).toBe(true)
    })

    it('should attach X-Device-Id from LocalStorage via request interceptor', async () => {
      const testDeviceId = 'device-uuid-9999-test'
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, testDeviceId)

      // @ts-expect-error accessing private axios interceptor handlers for test
      const requestInterceptor = apiClient.interceptors.request.handlers[0]
      expect(requestInterceptor).toBeDefined()

      const mockConfig = { headers: new AxiosHeaders() } as unknown as InternalAxiosRequestConfig
      const result = await requestInterceptor.fulfilled(mockConfig)

      expect(result.headers['X-Device-Id']).toBe(testDeviceId)
    })

    it('should attach Authorization Bearer token from in-memory token getter', async () => {
      registerTokenGetter(() => 'test_in_memory_jwt_token')

      // @ts-expect-error accessing private axios interceptor handlers for test
      const requestInterceptor = apiClient.interceptors.request.handlers[0]
      const mockConfig = { headers: new AxiosHeaders() } as unknown as InternalAxiosRequestConfig
      const result = await requestInterceptor.fulfilled(mockConfig)

      expect(result.headers['Authorization']).toBe('Bearer test_in_memory_jwt_token')
    })
  })

  describe('Response Interceptor - Envelope Unwrapping', () => {
    it('unwraps NestJS envelope { success: true, data: T } automatically', async () => {
      const { fulfilled } = getResponseInterceptor()
      const mockEnvelopeResponse: AxiosResponse = {
        data: { success: true, data: { id: 'conv-1', name: 'General Chat' } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      }

      const unwrapped = (await fulfilled(mockEnvelopeResponse)) as AxiosResponse
      expect(unwrapped.data).toEqual({ id: 'conv-1', name: 'General Chat' })
    })

    it('passes through non-envelope responses unchanged', async () => {
      const { fulfilled } = getResponseInterceptor()
      const rawResponse: AxiosResponse = {
        data: 'plain text response',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      }

      const result = (await fulfilled(rawResponse)) as AxiosResponse
      expect(result.data).toBe('plain text response')
    })
  })

  describe('Response Interceptor - Silent Refresh & Concurrency Lock (Task 6)', () => {
    it('passes through non-401 errors without triggering refresh or resetting session', async () => {
      const { rejected } = getResponseInterceptor()
      const mockRefresh = vi.fn()
      const mockReset = vi.fn()
      registerAuthRefreshHandler(mockRefresh)
      registerAuthResetHandler(mockReset)

      const error403 = {
        response: { status: 403, data: 'Forbidden' },
        config: { url: '/admin', headers: new AxiosHeaders() } as CustomAxiosRequestConfig,
      }

      await expect(rejected(error403)).rejects.toEqual(error403)
      expect(mockRefresh).not.toHaveBeenCalled()
      expect(mockReset).not.toHaveBeenCalled()
    })

    it('does not trigger silent refresh on 401 from auth endpoints (/auth/refresh or /auth/login)', async () => {
      const { rejected } = getResponseInterceptor()
      const mockRefresh = vi.fn()
      registerAuthRefreshHandler(mockRefresh)

      const refreshError401 = {
        response: { status: 401, data: 'Refresh cookie expired' },
        config: { url: '/auth/refresh', headers: new AxiosHeaders() } as CustomAxiosRequestConfig,
      }

      await expect(rejected(refreshError401)).rejects.toEqual(refreshError401)
      expect(mockRefresh).not.toHaveBeenCalled()
    })

    it('does not retry if request already has _retry flag set', async () => {
      const { rejected } = getResponseInterceptor()
      const mockRefresh = vi.fn()
      registerAuthRefreshHandler(mockRefresh)

      const alreadyRetriedError = {
        response: { status: 401 },
        config: { url: '/chat/messages', _retry: true, headers: new AxiosHeaders() } as CustomAxiosRequestConfig,
      }

      await expect(rejected(alreadyRetriedError)).rejects.toEqual(alreadyRetriedError)
      expect(mockRefresh).not.toHaveBeenCalled()
    })

    it('successfully refreshes token on 401 and retries original request with new token', async () => {
      const { rejected } = getResponseInterceptor()

      const newToken = 'refreshed-jwt-token-777'
      const mockRefresh = vi.fn().mockResolvedValue(newToken)
      registerAuthRefreshHandler(mockRefresh)

      // Mock the retry response from apiClient adapter
      const mockRetryResponse = {
        data: { success: true, data: { messages: ['hello'] } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      }
      apiClient.defaults.adapter = vi.fn().mockResolvedValue(mockRetryResponse)

      const originalConfig: CustomAxiosRequestConfig = {
        url: '/chat/messages',
        headers: new AxiosHeaders(),
      }
      const error401 = {
        response: { status: 401 },
        config: originalConfig,
      }

      const retryResult = (await rejected(error401)) as AxiosResponse
      const retryData = retryResult.data as { messages: string[] }

      expect(mockRefresh).toHaveBeenCalledTimes(1)
      expect(originalConfig._retry).toBe(true)
      expect(originalConfig.headers['Authorization']).toBe(`Bearer ${newToken}`)
      expect(retryData).toEqual({ messages: ['hello'] })
    })

    it('manages concurrency lock and request queue: 3 parallel 401s call refresh exactly once and resolve all 3', async () => {
      const { rejected } = getResponseInterceptor()

      const newToken = 'synchronized-jwt-token-999'
      let resolveRefreshPromise: (token: string) => void
      const delayedRefreshPromise = new Promise<string>((resolve) => {
        resolveRefreshPromise = resolve
      })

      const mockRefresh = vi.fn().mockImplementation(() => delayedRefreshPromise)
      registerAuthRefreshHandler(mockRefresh)

      apiClient.defaults.adapter = vi.fn().mockImplementation(async (config: InternalAxiosRequestConfig) => ({
        data: { success: true, data: { url: config.url, auth: config.headers['Authorization'] } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }))

      const req1Config: CustomAxiosRequestConfig = { url: '/chat/feed', headers: new AxiosHeaders() }
      const req2Config: CustomAxiosRequestConfig = { url: '/friends/list', headers: new AxiosHeaders() }
      const req3Config: CustomAxiosRequestConfig = { url: '/users/me', headers: new AxiosHeaders() }

      // 3 simultaneous 401 requests
      const p1 = rejected({ response: { status: 401 }, config: req1Config }) as Promise<AxiosResponse<{ auth: string }>>
      const p2 = rejected({ response: { status: 401 }, config: req2Config }) as Promise<AxiosResponse<{ auth: string }>>
      const p3 = rejected({ response: { status: 401 }, config: req3Config }) as Promise<AxiosResponse<{ auth: string }>>

      // Concurrency Lock: Exactly ONE refresh call is dispatched
      expect(mockRefresh).toHaveBeenCalledTimes(1)

      // Now resolve the refresh promise with the new token
      resolveRefreshPromise!(newToken)

      const [res1, res2, res3] = await Promise.all([p1, p2, p3])

      // All 3 requests received the new token and retried successfully
      expect(res1.data.auth).toBe(`Bearer ${newToken}`)
      expect(res2.data.auth).toBe(`Bearer ${newToken}`)
      expect(res3.data.auth).toBe(`Bearer ${newToken}`)

      // Refresh was still only called 1 time
      expect(mockRefresh).toHaveBeenCalledTimes(1)
    })

    it('handles refresh failure: rejects all queued requests and invokes reset handler', async () => {
      const { rejected } = getResponseInterceptor()

      const mockRefresh = vi.fn().mockResolvedValue(null) // Refresh failed
      const mockReset = vi.fn()
      registerAuthRefreshHandler(mockRefresh)
      registerAuthResetHandler(mockReset)

      const req1Config: CustomAxiosRequestConfig = { url: '/chat/feed', headers: new AxiosHeaders() }
      const req2Config: CustomAxiosRequestConfig = { url: '/friends/list', headers: new AxiosHeaders() }

      const p1 = rejected({ response: { status: 401 }, config: req1Config })
      const p2 = rejected({ response: { status: 401 }, config: req2Config })

      await expect(p1).rejects.toThrow('Không thể làm mới Access Token từ HttpOnly Cookie')
      await expect(p2).rejects.toThrow('Không thể làm mới Access Token từ HttpOnly Cookie')

      expect(mockReset).toHaveBeenCalledTimes(1)
    })
  })
})
