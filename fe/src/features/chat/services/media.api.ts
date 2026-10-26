import { apiClient } from '@/services/api.client'

export interface UploadMediaResponse {
  public_id: string
  secure_url: string
  format?: string
  resource_type?: string
}

export const mediaApi = {
  /**
   * POST /api/v1/media/upload
   * Tải tệp tin hoặc ảnh lên Cloudinary qua Backend
   * @param file File cần tải lên (Ảnh max 5MB, tài liệu max 25MB)
   * @param conversationId (Tùy chọn) ID phòng chat để backend tự động phát sóng tin nhắn
   * @param onProgress Callback thông báo tiến trình tải lên (0 - 100%)
   */
  uploadMedia: async (
    file: File,
    conversationId?: string,
    onProgress?: (progressPercent: number) => void
  ): Promise<UploadMediaResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    if (conversationId) {
      formData.append('conversationId', conversationId)
    }

    const res = await apiClient.post<UploadMediaResponse>('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      },
    })

    return res.data
  },
}
