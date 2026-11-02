import { describe, it, expect } from 'vitest'
import { describeUserAgent } from './describe-user-agent'

const UA = {
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
}

describe('describeUserAgent', () => {
  it.each([
    [UA.chromeWindows, 'desktop', 'Chrome trên Windows'],
    [UA.edgeWindows, 'desktop', 'Edge trên Windows'],
    [UA.safariMac, 'desktop', 'Safari trên macOS'],
    [UA.chromeAndroid, 'mobile', 'Chrome trên Android'],
    [UA.safariIphone, 'mobile', 'Safari trên iOS'],
    [UA.firefoxLinux, 'desktop', 'Firefox trên Linux'],
  ])('%s', (ua, kind, label) => {
    const result = describeUserAgent(ua)
    expect(result.kind).toBe(kind)
    expect(result.label).toBe(label)
  })

  it('falls back to an "other" device for missing or unknown user agents', () => {
    expect(describeUserAgent(undefined)).toMatchObject({ kind: 'other', label: 'Thiết bị không xác định' })
    expect(describeUserAgent('unknown')).toMatchObject({ kind: 'other' })
  })
})
