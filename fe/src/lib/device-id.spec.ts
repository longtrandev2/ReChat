import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getDeviceId, DEVICE_ID_STORAGE_KEY } from './device-id'

describe('getDeviceId', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('should generate a new UUID and persist it when LocalStorage is empty', () => {
    const id = getDeviceId()
    expect(id).toBeDefined()
    expect(typeof id).toBe('string')
    // UUID v4 format pattern
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    expect(localStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(id)
  })

  it('should return existing device ID from LocalStorage without generating a new one', () => {
    const existingUuid = '11111111-2222-4333-8444-555555555555'
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, existingUuid)

    const id = getDeviceId()
    expect(id).toBe(existingUuid)
    expect(localStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(existingUuid)
  })

  it('should return fallback default-device if localStorage throws an error', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('Storage disabled')
    })

    const id = getDeviceId()
    expect(id).toBe('default-device')
  })
})
