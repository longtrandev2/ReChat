import { z } from 'zod'

/**
 * Validation Schemas cho Settings Hub, khớp Business Rules trong SPEC.md:
 * - FR-04: displayName 1-50 ký tự
 * - BR-39: mật khẩu mới 8-72 ký tự, đủ chữ hoa, chữ thường, chữ số, ký tự đặc biệt,
 *          khác mật khẩu hiện tại và khớp mật khẩu xác nhận
 */
export const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/

export const displayNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Tên hiển thị không được để trống')
    .max(50, 'Tên hiển thị tối đa 50 ký tự'),
})

export type DisplayNameFormData = z.infer<typeof displayNameSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự')
      .max(72, 'Mật khẩu mới tối đa 72 ký tự')
      .regex(
        STRONG_PASSWORD_REGEX,
        'Mật khẩu mới phải có chữ hoa, chữ thường, chữ số và ký tự đặc biệt'
      ),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'Mật khẩu mới không được trùng mật khẩu hiện tại',
    path: ['newPassword'],
  })

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>

/** Khớp giới hạn ảnh của backend MediaService (jpg/png/webp/gif, tối đa 5MB) */
export const AVATAR_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024

/** @returns thông báo lỗi nếu file không hợp lệ, null nếu hợp lệ */
export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_ACCEPTED_TYPES.includes(file.type)) {
    return 'Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF'
  }
  if (file.size > AVATAR_MAX_SIZE_BYTES) {
    return 'Ảnh đại diện tối đa 5MB'
  }
  return null
}
