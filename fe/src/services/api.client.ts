import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { getDeviceId } from '@/lib/device-id'

export interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

interface QueuedRequest {
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
  config: CustomAxiosRequestConfig
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

let tokenGetter: (() => string | null) | null = null
let authRefreshHandler: (() => Promise<string | null>) | null = null
let authResetHandler: (() => void) | null = null

/**
 * Đăng ký hàm lấy Access Token từ Zustand In-Memory RAM Store
 * Giúp tránh circular dependency giữa api.client và auth.store.
 */
export const registerTokenGetter = (getter: () => string | null) => {
  tokenGetter = getter
}

/**
 * Đăng ký handler làm mới token bất đồng bộ (Silent Refresh)
 */
export const registerAuthRefreshHandler = (handler: () => Promise<string | null>) => {
  authRefreshHandler = handler
}

/**
 * Đăng ký handler dọn dẹp state xác thực khi phiên làm việc bị hủy
 */
export const registerAuthResetHandler = (handler: () => void) => {
  authResetHandler = handler
}

/**
 * Trạng thái khóa đồng thời (Concurrency Lock) và Hàng đợi Request (Request Queue)
 */
let isRefreshing = false
let failedQueue: QueuedRequest[] = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else if (token) {
      if (prom.config.headers) {
        if (typeof prom.config.headers.set === 'function') {
          prom.config.headers.set('Authorization', `Bearer ${token}`)
        } else {
          prom.config.headers.Authorization = `Bearer ${token}`
        }
      }
      prom.config._retry = true
      apiClient(prom.config)
        .then((res) => prom.resolve(res))
        .catch((err) => prom.reject(err))
    } else {
      prom.reject(new Error('Phiên xác thực không thể làm mới'))
    }
  })
  failedQueue = []
}

const handleAuthFailure = () => {
  if (authResetHandler) {
    authResetHandler()
  }
  if (typeof window !== 'undefined' && window.location) {
    const currentPath = window.location.pathname || ''
    const isPublicPage =
      currentPath.includes('/login') ||
      currentPath.includes('/register') ||
      currentPath.includes('/verify-otp') ||
      currentPath.includes('/verify-2fa') ||
      currentPath.includes('/forgot-password') ||
      currentPath.includes('/reset-password')

    if (!isPublicPage && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }
}

/**
 * Request Interceptor (Equivalent to Spring OncePerRequestFilter)
 * Tự động gắn Header X-Device-Id và Authorization: Bearer <in-memory-token>.
 */
apiClient.interceptors.request.use(
  (config) => {
    if (config.headers) {
      config.headers['X-Device-Id'] = getDeviceId()
    }

    const token = tokenGetter ? tokenGetter() : null
    if (token && config.headers) {
      if (typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`)
      } else {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

/**
 * Response Interceptor (Equivalent to Spring AuthenticationEntryPoint)
 * - Tự động unwrap envelope { success: true, data: T }
 * - Silent Refresh Interceptor với Request Queue & Concurrency Lock khi gặp 401
 */
apiClient.interceptors.response.use(
  (response) => {
    // Tự động unwrap envelope { success: true, data: T } của NestJS backend
    if (
      response.data &&
      typeof response.data === 'object' &&
      'data' in response.data &&
      'success' in response.data &&
      response.data.success === true
    ) {
      return {
        ...response,
        data: response.data.data,
      }
    }
    return response
  },
  async (error) => {
    const originalRequest = error?.config as CustomAxiosRequestConfig | undefined

    // 1. Nếu không phải lỗi 401 hoặc không có originalRequest (Lỗi mạng / DNS / Timeout) -> Bỏ qua, không xóa phiên
    if (error?.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error)
    }

    // 2. Không lặp vô tận: Nếu request thuộc nhóm endpoint auth công khai hoặc đã từng retry một lần rồi mà vẫn 401
    const isAuthExemptEndpoint =
      typeof originalRequest.url === 'string' &&
      (originalRequest.url.includes('/auth/refresh') ||
        originalRequest.url.includes('/auth/login') ||
        originalRequest.url.includes('/auth/logout') ||
        originalRequest.url.includes('/auth/register') ||
        originalRequest.url.includes('/auth/verify-email') ||
        originalRequest.url.includes('/auth/resend-verification') ||
        originalRequest.url.includes('/auth/2fa/verify-login') ||
        originalRequest.url.includes('/auth/2fa/resend-login-otp') ||
        originalRequest.url.includes('/auth/forgot-password') ||
        originalRequest.url.includes('/auth/reset-password'))

    if (isAuthExemptEndpoint || originalRequest._retry) {
      return Promise.reject(error)
    }

    // 3. Nếu đang có một tiến trình refresh chạy song song (Concurrency Lock) -> Đẩy vào hàng đợi chờ
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject, config: originalRequest })
      })
    }

    // 4. Request đầu tiên nhận 401 giữ khóa và kích hoạt Refresh Token
    originalRequest._retry = true
    isRefreshing = true

    try {
      if (!authRefreshHandler) {
        throw new Error('Chưa đăng ký AuthRefreshHandler cho apiClient')
      }

      const newToken = await authRefreshHandler()
      if (!newToken) {
        throw new Error('Không thể làm mới Access Token từ HttpOnly Cookie')
      }

      // Xử lý thông suốt toàn bộ hàng đợi đang chờ với token mới
      processQueue(null, newToken)

      // Thực thi lại chính request ban đầu với token mới
      if (originalRequest.headers) {
        if (typeof originalRequest.headers.set === 'function') {
          originalRequest.headers.set('Authorization', `Bearer ${newToken}`)
        } else {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
        }
      }
      return apiClient(originalRequest)
    } catch (refreshError) {
      // Refresh thất bại (Cookie hết hạn hoặc bị hủy): Hủy toàn bộ hàng đợi và đăng xuất an toàn
      processQueue(refreshError, null)
      handleAuthFailure()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)
