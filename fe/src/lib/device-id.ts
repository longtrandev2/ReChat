export const DEVICE_ID_STORAGE_KEY = 'rechat_device_id'

/**
 * Lấy hoặc khởi tạo mã UUID duy nhất định danh thiết bị hiện tại và lưu vào LocalStorage.
 * Luôn gửi kèm qua Header X-Device-Id trong các request xác thực (Auth).
 */
export function getDeviceId(): string {
  try {
    const storedId = localStorage.getItem(DEVICE_ID_STORAGE_KEY)
    if (storedId && storedId.trim()) {
      return storedId.trim()
    }

    const newId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0
            const v = c === 'x' ? r : (r & 0x3) | 0x8
            return v.toString(16)
          })

    localStorage.setItem(DEVICE_ID_STORAGE_KEY, newId)
    return newId
  } catch {
    return 'default-device'
  }
}
