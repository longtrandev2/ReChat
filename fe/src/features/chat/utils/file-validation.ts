/**
 * File validation rules & constants for ReChat attachments.
 * Aligns 100% with Backend MediaService and SPEC.md BR-M5-09.
 */

export const BLACKLIST_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.php',
  '.js',
  '.ts',
  '.mjs',
  '.py',
  '.dll',
  '.bin',
  '.msi',
  '.vbs',
  '.ps1',
  '.scr',
  '.com',
  '.pif',
  '.app',
  '.dmg',
  '.pkg',
  '.iso',
  '.html',
  '.htm',
]

export const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

export const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

export const ALLOWED_FILE_EXTS = [
  // Documents & text
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.csv',
  '.txt',
  '.md',
  '.rtf',
  // Safe Data / Config
  '.json',
  '.xml',
  '.yaml',
  '.yml',
  '.log',
  // Compressed Archives
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  // Audio
  '.mp3',
  '.wav',
  '.m4a',
  '.ogg',
  '.aac',
]

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
export const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
export const MAX_ATTACHMENTS = 10

export const FILE_INPUT_ACCEPT = [
  'image/*',
  ...ALLOWED_FILE_EXTS,
].join(',')

export interface FileValidationResult {
  valid: boolean
  error?: string
  isImage: boolean
}

/**
 * Validate a single file before queueing for upload.
 * Checks for dangerous executable/script extensions, verifies size limits,
 * and ensures file extension is in the supported whitelist.
 */
export function validateAttachment(file: File): FileValidationResult {
  const fileName = file.name || ''
  const lastDotIndex = fileName.lastIndexOf('.')
  const ext = lastDotIndex !== -1 ? fileName.slice(lastDotIndex).toLowerCase() : ''

  // 1. Kiểm tra blacklist các định dạng tệp thực thi / mã nguồn nguy hiểm
  if (BLACKLIST_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `"${fileName}" bị từ chối: Định dạng tệp tin bị cấm vì lý do an toàn bảo mật`,
      isImage: false,
    }
  }

  // 2. Phân loại ảnh
  const isImage =
    ALLOWED_IMAGE_MIMES.includes(file.type) || ALLOWED_IMAGE_EXTS.includes(ext)

  if (isImage) {
    if (file.size > MAX_IMAGE_SIZE) {
      return {
        valid: false,
        error: `"${fileName}" vượt quá dung lượng tối đa cho ảnh (5MB)`,
        isImage: true,
      }
    }
    return { valid: true, isImage: true }
  }

  // 3. Phân loại tệp tài liệu / media
  const isAllowedFile = ALLOWED_FILE_EXTS.includes(ext)
  if (!isAllowedFile) {
    return {
      valid: false,
      error: `"${fileName}" có định dạng không được hỗ trợ`,
      isImage: false,
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `"${fileName}" vượt quá dung lượng tối đa cho tệp tin (25MB)`,
      isImage: false,
    }
  }

  return { valid: true, isImage: false }
}
