/**
 * Lưu mfaToken tạm thời trong sessionStorage (chỉ tab hiện tại, mất khi đóng tab) để F5 trang /verify-2fa
 * không mất phiên thử thách; token được truyền qua router state thay vì URL query (tránh lộ vào history/log).
 */
const KEY = 'rechat_mfa_token'

export const mfaTokenSession = {
  save(token: string): void {
    try {
      sessionStorage.setItem(KEY, token)
    } catch {
      // sessionStorage không khả dụng: vẫn còn router state
    }
  },
  read(): string {
    try {
      return sessionStorage.getItem(KEY) || ''
    } catch {
      return ''
    }
  },
  clear(): void {
    try {
      sessionStorage.removeItem(KEY)
    } catch {
      // ignore
    }
  },
}
