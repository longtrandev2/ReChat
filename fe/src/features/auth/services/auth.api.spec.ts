import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/api.client', () => ({
  apiClient: { post: vi.fn(), get: vi.fn() },
}))

import { apiClient } from '@/services/api.client'
import { authApi } from './auth.api'

describe('authApi.login payload (LoginDto chỉ nhận trường username)', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset()
    vi.mocked(apiClient.post).mockResolvedValue({ data: { accessToken: 't', user: {} } })
  })

  it('gửi email dưới trường username để backend không lọc mất (regression: login bằng email trả 400)', async () => {
    await authApi.login({ usernameOrEmail: ' alex@rechat.app ', password: 'Secret@123' })

    expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
      username: 'alex@rechat.app',
      password: 'Secret@123',
    })
  })

  it('gửi username bình thường khi người dùng nhập tên tài khoản', async () => {
    await authApi.login({ usernameOrEmail: 'alex', password: 'Secret@123' })

    expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
      username: 'alex',
      password: 'Secret@123',
    })
  })
})
