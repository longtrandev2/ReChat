import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

/**
 * Request Interceptor (Equivalent to Spring OncePerRequestFilter)
 * Automatically attaches Authorization: Bearer <token> if available.
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('rechat_access_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

/**
 * Response Interceptor (Equivalent to Spring AuthenticationEntryPoint)
 * Catches 401 Unauthorized and clears local session.
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
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or blacklisted in Redis
      localStorage.removeItem('rechat_access_token')
      // Only redirect if not already on login or register pages
      const currentPath = window.location.pathname
      if (!currentPath.includes('/login') && !currentPath.includes('/register') && !currentPath.includes('/verify-otp')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
