import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { toast } from 'sonner'
import { isSafeHttpUrl, openSafeUrl } from './safe-url'

describe('safe-url', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(['https://res.cloudinary.com/a/b.png', 'http://localhost:3000/x'])('accepts %s', (url) => {
    expect(isSafeHttpUrl(url)).toBe(true)
  })

  it.each(['javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'ftp://a.b/c', '/relative', 'not a url', '', null, undefined])(
    'rejects %s',
    (url) => {
      expect(isSafeHttpUrl(url as string | null | undefined)).toBe(false)
    }
  )

  it('openSafeUrl opens http(s) with noopener and returns true', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    expect(openSafeUrl('https://example.com/a.pdf')).toBe(true)
    expect(openSpy).toHaveBeenCalledWith('https://example.com/a.pdf', '_blank', 'noopener,noreferrer')
    openSpy.mockRestore()
  })

  it('openSafeUrl refuses unsafe URL, toasts and does not open', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    expect(openSafeUrl('javascript:alert(1)')).toBe(false)
    expect(openSpy).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
    openSpy.mockRestore()
  })
})
