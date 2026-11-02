export type DeviceKind = 'mobile' | 'desktop' | 'other'

export interface DeviceDescription {
  kind: DeviceKind
  os: string
  browser: string
  /** Nhãn hiển thị, ví dụ "Chrome trên Windows" */
  label: string
}

// Thứ tự quan trọng: Android chứa "Linux", iPhone/iPad chứa "Mac OS X"
const OS_RULES: Array<{ pattern: RegExp; os: string; kind: DeviceKind }> = [
  { pattern: /android/i, os: 'Android', kind: 'mobile' },
  { pattern: /iphone|ipad|ipod/i, os: 'iOS', kind: 'mobile' },
  { pattern: /windows/i, os: 'Windows', kind: 'desktop' },
  { pattern: /mac os x|macintosh/i, os: 'macOS', kind: 'desktop' },
  { pattern: /linux|x11/i, os: 'Linux', kind: 'desktop' },
]

// Thứ tự quan trọng: Edge/Opera chứa "Chrome", Chrome chứa "Safari"
const BROWSER_RULES: Array<{ pattern: RegExp; browser: string }> = [
  { pattern: /edg\//i, browser: 'Edge' },
  { pattern: /opr\/|opera/i, browser: 'Opera' },
  { pattern: /firefox|fxios/i, browser: 'Firefox' },
  { pattern: /chrome|crios/i, browser: 'Chrome' },
  { pattern: /safari/i, browser: 'Safari' },
]

/**
 * Phân tích User-Agent để hiển thị icon và nhãn thiết bị trong tab Thiết bị & Phiên.
 */
export function describeUserAgent(userAgent?: string): DeviceDescription {
  const ua = userAgent && userAgent !== 'unknown' ? userAgent : ''
  const osRule = OS_RULES.find((rule) => rule.pattern.test(ua))
  const browserRule = BROWSER_RULES.find((rule) => rule.pattern.test(ua))

  const os = osRule?.os ?? 'Không rõ hệ điều hành'
  const browser = browserRule?.browser ?? 'Trình duyệt không xác định'

  return {
    kind: osRule?.kind ?? 'other',
    os,
    browser,
    label: osRule || browserRule ? `${browser} trên ${os}` : 'Thiết bị không xác định',
  }
}
