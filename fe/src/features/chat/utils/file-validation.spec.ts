import { describe, it, expect } from 'vitest'
import {
  validateAttachment,
  BLACKLIST_EXTENSIONS,
  ALLOWED_IMAGE_EXTS,
  ALLOWED_FILE_EXTS,
  MAX_IMAGE_SIZE,
  MAX_FILE_SIZE,
  FILE_INPUT_ACCEPT,
} from './file-validation'

describe('file-validation', () => {
  it('should include correct constants and accepts', () => {
    expect(BLACKLIST_EXTENSIONS).toContain('.exe')
    expect(BLACKLIST_EXTENSIONS).toContain('.sh')
    expect(BLACKLIST_EXTENSIONS).toContain('.ps1')
    expect(BLACKLIST_EXTENSIONS).toContain('.html')

    expect(ALLOWED_IMAGE_EXTS).toEqual(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
    expect(ALLOWED_FILE_EXTS).toContain('.md')
    expect(ALLOWED_FILE_EXTS).toContain('.json')
    expect(ALLOWED_FILE_EXTS).toContain('.7z')
    expect(ALLOWED_FILE_EXTS).toContain('.mp3')

    expect(FILE_INPUT_ACCEPT).toContain('image/*')
    expect(FILE_INPUT_ACCEPT).toContain('.md')
    expect(FILE_INPUT_ACCEPT).toContain('.pdf')
  })

  it('should reject blacklisted files (.exe, .sh, .bat, .ps1, .html, etc.)', () => {
    const exeFile = new File(['content'], 'payload.exe', { type: 'application/x-msdownload' })
    const resExe = validateAttachment(exeFile)
    expect(resExe.valid).toBe(false)
    expect(resExe.error).toContain('bị cấm vì lý do an toàn bảo mật')

    const ps1File = new File(['code'], 'script.ps1', { type: 'text/plain' })
    const resPs1 = validateAttachment(ps1File)
    expect(resPs1.valid).toBe(false)
    expect(resPs1.error).toContain('bị cấm vì lý do an toàn bảo mật')

    const htmlFile = new File(['<script></script>'], 'phish.html', { type: 'text/html' })
    const resHtml = validateAttachment(htmlFile)
    expect(resHtml.valid).toBe(false)
  })

  it('should accept valid images up to 5MB and classify as image', () => {
    const validJpg = new File(['fake-jpg'], 'photo.jpg', { type: 'image/jpeg' })
    const res = validateAttachment(validJpg)
    expect(res.valid).toBe(true)
    expect(res.isImage).toBe(true)
    expect(res.error).toBeUndefined()
  })

  it('should reject images larger than 5MB', () => {
    const bigContent = new Uint8Array(MAX_IMAGE_SIZE + 1024)
    const bigJpg = new File([bigContent], 'large-photo.png', { type: 'image/png' })
    const res = validateAttachment(bigJpg)
    expect(res.valid).toBe(false)
    expect(res.isImage).toBe(true)
    expect(res.error).toContain('vượt quá dung lượng tối đa cho ảnh (5MB)')
  })

  it('should accept diverse file formats up to 25MB (markdown, office, json, archives, audio)', () => {
    const mdFile = new File(['# Documentation'], 'SPEC.md', { type: 'text/markdown' })
    const resMd = validateAttachment(mdFile)
    expect(resMd.valid).toBe(true)
    expect(resMd.isImage).toBe(false)

    const jsonFile = new File(['{"ok":true}'], 'config.json', { type: 'application/json' })
    const resJson = validateAttachment(jsonFile)
    expect(resJson.valid).toBe(true)
    expect(resJson.isImage).toBe(false)

    const audioFile = new File(['voice-data'], 'audio.mp3', { type: 'audio/mpeg' })
    const resAudio = validateAttachment(audioFile)
    expect(resAudio.valid).toBe(true)
    expect(resAudio.isImage).toBe(false)

    const archiveFile = new File(['archive-data'], 'backup.7z', { type: 'application/x-7z-compressed' })
    const res7z = validateAttachment(archiveFile)
    expect(res7z.valid).toBe(true)
    expect(res7z.isImage).toBe(false)
  })

  it('should reject documents larger than 25MB', () => {
    const bigDocContent = new Uint8Array(MAX_FILE_SIZE + 1024)
    const bigPdf = new File([bigDocContent], 'big-book.pdf', { type: 'application/pdf' })
    const res = validateAttachment(bigPdf)
    expect(res.valid).toBe(false)
    expect(res.isImage).toBe(false)
    expect(res.error).toContain('vượt quá dung lượng tối đa cho tệp tin (25MB)')
  })

  it('should reject unsupported file extensions', () => {
    const unsupported = new File(['weird'], 'weird.iso9660', { type: 'application/octet-stream' })
    const res = validateAttachment(unsupported)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('có định dạng không được hỗ trợ')
  })
})
