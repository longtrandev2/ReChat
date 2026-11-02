import { describe, it, expect } from 'vitest'
import { changePasswordSchema, displayNameSchema, validateAvatarFile } from './settings.schema'

const errorsOf = (result: ReturnType<typeof changePasswordSchema.safeParse>) =>
  result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)

describe('changePasswordSchema (BR-39)', () => {
  const valid = { currentPassword: 'OldPass@1', newPassword: 'NewPass@2', confirmPassword: 'NewPass@2' }

  it('accepts a strong password that differs from the current one', () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true)
  })

  it.each([
    ['newpass@2', 'thiếu chữ hoa'],
    ['NEWPASS@2', 'thiếu chữ thường'],
    ['NewPass@@', 'thiếu chữ số'],
    ['NewPass22', 'thiếu ký tự đặc biệt'],
  ])('rejects %s (%s)', (newPassword) => {
    const result = changePasswordSchema.safeParse({ ...valid, newPassword, confirmPassword: newPassword })
    expect(errorsOf(result).join()).toContain('chữ hoa, chữ thường, chữ số và ký tự đặc biệt')
  })

  it('rejects passwords shorter than 8 or longer than 72 characters', () => {
    expect(errorsOf(changePasswordSchema.safeParse({ ...valid, newPassword: 'Ab@1', confirmPassword: 'Ab@1' })).join()).toContain(
      'ít nhất 8 ký tự'
    )
    const long = `Aa@1${'x'.repeat(70)}`
    expect(errorsOf(changePasswordSchema.safeParse({ ...valid, newPassword: long, confirmPassword: long })).join()).toContain(
      'tối đa 72 ký tự'
    )
  })

  it('rejects a confirmation that does not match', () => {
    expect(errorsOf(changePasswordSchema.safeParse({ ...valid, confirmPassword: 'Other@123' }))).toContain(
      'confirmPassword: Mật khẩu xác nhận không khớp'
    )
  })

  it('rejects a new password equal to the current password', () => {
    const same = { currentPassword: 'Same@1234', newPassword: 'Same@1234', confirmPassword: 'Same@1234' }
    expect(errorsOf(changePasswordSchema.safeParse(same))).toContain(
      'newPassword: Mật khẩu mới không được trùng mật khẩu hiện tại'
    )
  })
})

describe('displayNameSchema', () => {
  it('trims and requires 1-50 characters', () => {
    expect(displayNameSchema.safeParse({ displayName: '   ' }).success).toBe(false)
    expect(displayNameSchema.safeParse({ displayName: 'x'.repeat(51) }).success).toBe(false)
    expect(displayNameSchema.parse({ displayName: '  Alex  ' }).displayName).toBe('Alex')
  })
})

describe('validateAvatarFile', () => {
  it('accepts supported images up to 5MB', () => {
    expect(validateAvatarFile(new File(['x'], 'a.png', { type: 'image/png' }))).toBeNull()
  })

  it('rejects unsupported types and files over 5MB', () => {
    expect(validateAvatarFile(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toContain('JPG, PNG')
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' })
    expect(validateAvatarFile(big)).toContain('5MB')
  })
})
