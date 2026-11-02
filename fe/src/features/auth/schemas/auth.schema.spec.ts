import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  registerSchema,
  otpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema'

describe('Auth Validation Schemas (ZOMBIES Methodology)', () => {
  describe('loginSchema', () => {
    // Z - Zero / Empty
    it('Z: rejects empty inputs for username/email and password', () => {
      // Arrange
      const emptyPayload = { usernameOrEmail: '', password: '' }

      // Act
      const result = loginSchema.safeParse(emptyPayload)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors
        expect(errors.usernameOrEmail?.[0]).toContain('ít nhất 3 ký tự')
        expect(errors.password?.[0]).toContain('ít nhất 6 ký tự')
      }
    })

    // B - Boundaries
    it('B: boundary check for username/email length (2 vs 3 chars)', () => {
      // Arrange & Act (Below boundary: 2 chars)
      const belowBoundary = loginSchema.safeParse({ usernameOrEmail: 'ab', password: 'password123' })
      // Arrange & Act (At boundary: 3 chars)
      const atBoundary = loginSchema.safeParse({ usernameOrEmail: 'abc', password: 'password123' })

      // Assert
      expect(belowBoundary.success).toBe(false)
      expect(atBoundary.success).toBe(true)
    })

    it('B: boundary check for password length (5 vs 6 chars)', () => {
      // Arrange & Act
      const belowBoundary = loginSchema.safeParse({ usernameOrEmail: 'alex', password: '12345' })
      const atBoundary = loginSchema.safeParse({ usernameOrEmail: 'alex', password: '123456' })

      // Assert
      expect(belowBoundary.success).toBe(false)
      expect(atBoundary.success).toBe(true)
    })

    // S - Simple Scenarios
    it('S: accepts valid username or email with sufficient password', () => {
      // Arrange
      const usernamePayload = { usernameOrEmail: 'alex_tr', password: 'secure_password' }
      const emailPayload = { usernameOrEmail: 'alex@rechat.app', password: 'secure_password' }

      // Act
      const resUser = loginSchema.safeParse(usernamePayload)
      const resEmail = loginSchema.safeParse(emailPayload)

      // Assert
      expect(resUser.success).toBe(true)
      expect(resEmail.success).toBe(true)
    })
  })

  describe('registerSchema (BR-01, BR-02, BR-21)', () => {
    // Z - Zero / Empty
    it('Z: rejects completely empty registration form', () => {
      // Arrange
      const payload = { username: '', email: '', password: '', confirmPassword: '' }

      // Act
      const result = registerSchema.safeParse(payload)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors
        expect(errors.username).toBeDefined()
        expect(errors.email).toBeDefined()
        expect(errors.password).toBeDefined()
      }
    })

    // B - Boundaries (BR-01: 3 to 20 chars)
    it('B: validates username min/max length boundaries (2, 3, 20, 21 chars)', () => {
      // Arrange: 2 chars (too short), 3 chars (min valid), 20 chars (max valid), 21 chars (too long)
      const u2 = registerSchema.safeParse({
        username: 'ab',
        email: 'u@test.com',
        password: 'password123',
        confirmPassword: 'password123',
      })
      const u3 = registerSchema.safeParse({
        username: 'abc',
        email: 'u@test.com',
        password: 'password123',
        confirmPassword: 'password123',
      })
      const u20 = registerSchema.safeParse({
        username: 'a'.repeat(20),
        email: 'u@test.com',
        password: 'password123',
        confirmPassword: 'password123',
      })
      const u21 = registerSchema.safeParse({
        username: 'a'.repeat(21),
        email: 'u@test.com',
        password: 'password123',
        confirmPassword: 'password123',
      })

      // Assert
      expect(u2.success).toBe(false)
      expect(u3.success).toBe(true)
      expect(u20.success).toBe(true)
      expect(u21.success).toBe(false)
    })

    // I - Interface & Regex Constraints (Alphanumeric + Underscore only)
    it('I: rejects usernames with spaces or special characters outside [a-zA-Z0-9_]', () => {
      // Arrange
      const spaceUsername = { username: 'alex doe', email: 'a@t.com', password: 'pwd123', confirmPassword: 'pwd123' }
      const symbolUsername = { username: 'alex@chat', email: 'a@t.com', password: 'pwd123', confirmPassword: 'pwd123' }
      const dotUsername = { username: 'alex.tr', email: 'a@t.com', password: 'pwd123', confirmPassword: 'pwd123' }
      const validUnderscore = { username: 'alex_tr_99', email: 'a@t.com', password: 'pwd123', confirmPassword: 'pwd123' }

      // Act & Assert
      expect(registerSchema.safeParse(spaceUsername).success).toBe(false)
      expect(registerSchema.safeParse(symbolUsername).success).toBe(false)
      expect(registerSchema.safeParse(dotUsername).success).toBe(false)
      expect(registerSchema.safeParse(validUnderscore).success).toBe(true)
    })

    // I - Interface: Email validation (BR-21)
    it('I: rejects malformed email addresses', () => {
      // Arrange & Act
      const noDomain = registerSchema.safeParse({
        username: 'alextr',
        email: 'alextr@',
        password: 'password123',
        confirmPassword: 'password123',
      })
      const noAtSign = registerSchema.safeParse({
        username: 'alextr',
        email: 'alextr.domain.com',
        password: 'password123',
        confirmPassword: 'password123',
      })

      // Assert
      expect(noDomain.success).toBe(false)
      expect(noAtSign.success).toBe(false)
    })

    // E - Exceptions / Refinement Rules (BR-02: Password matching)
    it('E: fails validation when confirmPassword does not match password', () => {
      // Arrange
      const payload = {
        username: 'alex_tr',
        email: 'alex@rechat.app',
        password: 'password123',
        confirmPassword: 'differentPassword456',
      }

      // Act
      const result = registerSchema.safeParse(payload)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        const confirmErr = result.error.issues.find((i) => i.path.includes('confirmPassword'))
        expect(confirmErr).toBeDefined()
        expect(confirmErr?.message).toBe('Mật khẩu xác nhận không khớp với mật khẩu')
      }
    })
  })

  describe('otpSchema (BR-22: 6 digits)', () => {
    // Z - Zero / Empty
    it('Z: rejects empty OTP string', () => {
      // Arrange & Act
      const result = otpSchema.safeParse({ otp: '' })

      // Assert
      expect(result.success).toBe(false)
    })

    // B - Boundaries (5, 6, 7 chars)
    it('B: strictly enforces exactly 6 digits length', () => {
      // Arrange: 5 chars, 6 chars, 7 chars
      const otp5 = otpSchema.safeParse({ otp: '12345' })
      const otp6 = otpSchema.safeParse({ otp: '123456' })
      const otp7 = otpSchema.safeParse({ otp: '1234567' })

      // Assert
      expect(otp5.success).toBe(false)
      expect(otp6.success).toBe(true)
      expect(otp7.success).toBe(false)
    })

    // I - Interface / Regex: Digits only
    it('I: rejects non-numeric characters in OTP', () => {
      // Arrange & Act
      const alphaOtp = otpSchema.safeParse({ otp: '12A456' })
      const symbolOtp = otpSchema.safeParse({ otp: '12#456' })
      const spaceOtp = otpSchema.safeParse({ otp: '12 456' })

      // Assert
      expect(alphaOtp.success).toBe(false)
      expect(symbolOtp.success).toBe(false)
      expect(spaceOtp.success).toBe(false)
    })
  })

  describe('forgotPasswordSchema', () => {
    // Z - Zero
    it('Z: rejects empty email', () => {
      // Arrange & Act
      const result = forgotPasswordSchema.safeParse({ email: '' })

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.email?.[0]).toContain('không được để trống')
      }
    })

    // S - Simple & Valid
    it('S: accepts valid email for password recovery', () => {
      // Arrange & Act
      const result = forgotPasswordSchema.safeParse({ email: 'user@rechat.app' })

      // Assert
      expect(result.success).toBe(true)
    })
  })

  describe('resetPasswordSchema', () => {
    // E - Exceptions / Refinements
    it('E: rejects when confirmPassword does not match newPassword', () => {
      // Arrange
      const payload = {
        token: 'valid-uuid-token',
        newPassword: 'newSecretPassword123',
        confirmPassword: 'mismatchedPassword',
      }

      // Act
      const result = resetPasswordSchema.safeParse(payload)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('confirmPassword'))
        expect(issue?.message).toBe('Mật khẩu xác nhận không khớp với mật khẩu mới')
      }
    })

    // S - Simple & Valid
    it('S: accepts matching passwords with valid token', () => {
      // Arrange
      const payload = {
        token: 'valid-uuid-token',
        newPassword: 'newSecretPassword123',
        confirmPassword: 'newSecretPassword123',
      }

      // Act
      const result = resetPasswordSchema.safeParse(payload)

      // Assert
      expect(result.success).toBe(true)
    })
  })
})
