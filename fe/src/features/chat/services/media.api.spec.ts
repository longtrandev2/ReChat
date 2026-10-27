import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mediaApi } from './media.api'
import { apiClient } from '@/services/api.client'

vi.mock('@/services/api.client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}))

describe('Media API Service Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uploads file with conversationId and calls onProgress callback', async () => {
    const mockFile = new File(['fake content'], 'test.png', { type: 'image/png' })
    const mockResponse = {
      data: {
        public_id: 'rechat/images/mock_123',
        secure_url: 'https://res.cloudinary.com/test/image/upload/mock_123.png',
        format: 'png',
        resource_type: 'image',
      },
    }

    vi.mocked(apiClient.post).mockImplementation(
      (_url, _data, config) => {
        if (config?.onUploadProgress) {
          config.onUploadProgress({
            loaded: 50,
            total: 100,
            bytes: 50,
            lengthComputable: true,
          })
        }
        return Promise.resolve(mockResponse) as ReturnType<typeof apiClient.post>
      }
    )

    const onProgress = vi.fn()
    const result = await mediaApi.uploadMedia(mockFile, 'conv-123', onProgress)

    expect(apiClient.post).toHaveBeenCalledTimes(1)
    const [url, formData, config] = vi.mocked(apiClient.post).mock.calls[0]

    expect(url).toBe('/media/upload')
    expect(formData).toBeInstanceOf(FormData)
    expect((formData as FormData).get('conversationId')).toBe('conv-123')
    expect(config?.headers?.['Content-Type']).toBe('multipart/form-data')
    expect(onProgress).toHaveBeenCalledWith(50)
    expect(result).toEqual(mockResponse.data)
  })

  it('uploads standalone file without conversationId', async () => {
    const mockFile = new File(['document content'], 'spec.pdf', { type: 'application/pdf' })
    const mockResponse = {
      data: {
        public_id: 'rechat/raw/mock_doc',
        secure_url: 'https://res.cloudinary.com/test/raw/upload/mock_doc.pdf',
      },
    }

    vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse)

    const result = await mediaApi.uploadMedia(mockFile)

    expect(apiClient.post).toHaveBeenCalledTimes(1)
    const [, formData] = vi.mocked(apiClient.post).mock.calls[0]
    expect((formData as FormData).get('conversationId')).toBeNull()
    expect(result).toEqual(mockResponse.data)
  })
})
