import { z } from 'zod'

/**
 * Validation Schemas matching SPEC.md Business Rules:
 * BR-01: username 3-20 chars alphanumeric + '_'
 * BR-02: password min 6 chars, confirmPassword matches
 * BR-21: email standard format
 * BR-22: OTP 6 digits
 */

export const loginSchema = z.object({
  usernameOrEmail: z
    .string()
    .min(3, 'Tài khoản hoặc email phải có ít nhất 3 ký tự'),
  password: z
    .string()
    .min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Username từ 3 đến 20 ký tự')
      .max(20, 'Username từ 3 đến 20 ký tự')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username chỉ chứa chữ cái, số và dấu gạch dưới (_)'),
    email: z
      .string()
      .min(1, 'Email không được để trống')
      .email('Địa chỉ email không đúng định dạng'),
    password: z
      .string()
      .min(6, 'Mật khẩu phải từ 6 ký tự trở lên'),
    confirmPassword: z
      .string()
      .min(6, 'Xác nhận mật khẩu phải từ 6 ký tự trở lên'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp với mật khẩu',
    path: ['confirmPassword'],
  })

export type RegisterFormData = z.infer<typeof registerSchema>

export const otpSchema = z.object({
  otp: z
    .string()
    .length(6, 'Mã OTP gồm đúng 6 chữ số')
    .regex(/^\d{6}$/, 'Mã OTP chỉ bao gồm các chữ số'),
})

export type OtpFormData = z.infer<typeof otpSchema>
