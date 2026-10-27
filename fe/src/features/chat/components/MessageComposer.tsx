import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send,
  Paperclip,
  Smile,
  X,
  Pencil,
  Loader2,
  Check,
  Reply,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { socketClient } from '@/services/socket.client'
import { mediaApi } from '../services/media.api'
import { useMessagesStore } from '../stores/messages.store'
import { formatFileSize } from '@/lib/utils'

interface PendingAttachment {
  id: string
  file: File
  previewUrl?: string
  isImage: boolean
}

interface MessageComposerProps {
  conversationId: string
  onSendMessage: (content: string, replyToId?: string) => void | Promise<void>
  onEditMessage?: (messageId: string, content: string) => void | Promise<void>
  disabled?: boolean
}

/**
 * MessageComposer: Thanh soạn thảo tin nhắn Telegram với Textarea co giãn tự động và Debounce Typing
 * - Hỗ trợ dán ảnh trực tiếp từ Clipboard (Ctrl + V)
 * - Hỗ trợ đính kèm hàng loạt nhiều ảnh/tệp tin cùng lúc (Bulk Files)
 * - Dải xem trước ảnh/tệp (Attachment Preview Strip) kèm nút xóa nhanh từng tệp
 * - Cho phép gửi kèm ảnh với lời bình (Caption) cùng một lúc
 * - Enter để gửi, Shift+Enter để xuống dòng
 * - Co giãn tự động 1-5 dòng (max 120px)
 * - Tự động phát socket 'typing' kèm debounce 2.5s
 * - Nút đính kèm ảnh (max 5MB) và tệp tin (max 25MB) lên Cloudinary
 * - Chế độ Chỉnh sửa tin nhắn (Edit Mode) kèm Banner và nút Hủy
 */
export function MessageComposer({
  conversationId,
  onSendMessage,
  onEditMessage,
  disabled = false,
}: MessageComposerProps) {
  const [content, setContent] = useState('')
  const [prevEditingId, setPrevEditingId] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])

  const {
    editingMessage,
    setEditingMessage,
    replyingMessage,
    setReplyingMessage,
  } = useMessagesStore()

  // Đồng bộ nội dung tin nhắn sửa trong quá trình render (React 19 idiomatic pattern)
  if (editingMessage && editingMessage.id !== prevEditingId) {
    setPrevEditingId(editingMessage.id)
    setContent(editingMessage.content)
  } else if (!editingMessage && prevEditingId !== null) {
    setPrevEditingId(null)
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(
    -1 as unknown as ReturnType<typeof setTimeout>
  )

  // Tự động focus textarea khi bấm trả lời
  useEffect(() => {
    if (replyingMessage) {
      textareaRef.current?.focus()
    }
  }, [replyingMessage])

  // Điều chỉnh chiều cao textarea theo nội dung gõ
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxHeight = 120 // ~5 dòng
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [])

  // Auto focus & auto resize textarea khi chuyển sang chế độ sửa
  useEffect(() => {
    if (editingMessage) {
      adjustHeight()
      textareaRef.current?.focus()
    }
  }, [editingMessage, adjustHeight])

  // Dọn dẹp các Blob URL xem trước ảnh khi component unmount
  useEffect(() => {
    return () => {
      pendingAttachments.forEach((att) => {
        if (att.previewUrl) {
          URL.revokeObjectURL(att.previewUrl)
        }
      })
    }
  }, [pendingAttachments])

  // Thêm tệp vào danh sách xem trước (Pending Attachments)
  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    const validAttachments: PendingAttachment[] = []

    for (const file of fileArray) {
      const isImage = file.type.startsWith('image/')
      const maxSizeBytes = isImage ? 5 * 1024 * 1024 : 25 * 1024 * 1024

      if (file.size > maxSizeBytes) {
        toast.error(
          `"${file.name}" vượt quá dung lượng cho phép (${isImage ? '5MB' : '25MB'})`
        )
        continue
      }

      validAttachments.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        isImage,
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
      })
    }

    if (validAttachments.length > 0) {
      setPendingAttachments((prev) => {
        const existingKeys = new Set(prev.map((p) => `${p.file.name}_${p.file.size}`))
        const uniqueNew = validAttachments.filter(
          (v) => !existingKeys.has(`${v.file.name}_${v.file.size}`)
        )
        return [...prev, ...uniqueNew]
      })
    }
  }, [])

  // Xóa một tệp khỏi danh sách chờ gửi
  const handleRemoveAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((a) => a.id === id)
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl)
      }
      return prev.filter((a) => a.id !== id)
    })
  }, [])

  // Xử lý dán dữ liệu từ Clipboard (Ctrl + V ảnh hoặc tệp)
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items || items.length === 0) return

      const files: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) {
            files.push(file)
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        addFiles(files)
      }
    },
    [addFiles]
  )

  const handleCancelEdit = () => {
    setEditingMessage(null)
    setContent('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  // Xử lý gửi tin nhắn hoặc lưu chỉnh sửa
  const handleSend = async () => {
    const trimmed = content.trim()
    const hasPendingFiles = pendingAttachments.length > 0

    if ((!trimmed && !hasPendingFiles) || isSending || disabled || isUploading) return

    // Hủy trạng thái typing ngay khi ấn gửi
    if (typingTimeoutRef.current !== -1) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = -1 as unknown as ReturnType<typeof setTimeout>
    }
    const socket = socketClient.getSocket()
    if (socket && conversationId) {
      socket.emit('typing', { conversationId, isTyping: false })
    }

    if (editingMessage) {
      const msgId = editingMessage.id
      setEditingMessage(null)
      setContent('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
      if (onEditMessage) {
        await onEditMessage(msgId, trimmed)
      }
      return
    }

    const replyId = replyingMessage?.id
    if (replyingMessage) {
      setReplyingMessage(null)
    }

    // Tải lên các tệp đính kèm chờ gửi (Bulk media / files)
    if (hasPendingFiles) {
      const filesToUpload = [...pendingAttachments]
      setPendingAttachments([])

      try {
        setIsUploading(true)
        for (let i = 0; i < filesToUpload.length; i++) {
          const item = filesToUpload[i]
          await mediaApi.uploadMedia(item.file, conversationId, (percent) => {
            setUploadPercent(
              Math.round(((i + percent / 100) / filesToUpload.length) * 100)
            )
          })
          if (item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl)
          }
        }
        toast.success(
          filesToUpload.length > 1
            ? `Đã gửi ${filesToUpload.length} tệp đính kèm`
            : filesToUpload[0].isImage
            ? 'Đã tải ảnh lên thành công'
            : 'Đã gửi tệp đính kèm'
        )
      } catch {
        toast.error('Không thể tải tệp lên. Vui lòng thử lại.')
      } finally {
        setIsUploading(false)
        setUploadPercent(0)
      }
    }

    // Nếu người dùng có nhập nội dung văn bản (hoặc lời bình caption cho ảnh), gửi tin nhắn văn bản
    if (trimmed) {
      setContent('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.focus()
      }

      try {
        setIsSending(true)
        if (replyId) {
          await onSendMessage(trimmed, replyId)
        } else {
          await onSendMessage(trimmed)
        }
      } finally {
        setIsSending(false)
      }
    }
  }

  // Xử lý chọn tệp đính kèm từ file input
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files)
      e.target.value = ''
    }
  }

  // Lắng nghe thay đổi nội dung và phát socket typing (debounce 2.5s)
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    adjustHeight()

    const socket = socketClient.getSocket()
    if (!socket || !conversationId) return

    socket.emit('typing', { conversationId, isTyping: true })

    if (typingTimeoutRef.current !== -1) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { conversationId, isTyping: false })
      typingTimeoutRef.current = -1 as unknown as ReturnType<typeof setTimeout>
    }, 2500)
  }

  // Xử lý phím tắt Enter vs Shift+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Dọn dẹp timer typing khi đổi phòng chat hoặc unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current !== -1) {
        clearTimeout(typingTimeoutRef.current)
        const socket = socketClient.getSocket()
        if (socket && conversationId) {
          socket.emit('typing', { conversationId, isTyping: false })
        }
      }
    }
  }, [conversationId])

  const canSend =
    (content.trim().length > 0 || pendingAttachments.length > 0) &&
    !isSending &&
    !disabled &&
    !isUploading

  return (
    <div
      className="p-3 md:pb-4 max-w-3xl mx-auto w-full flex flex-col gap-1 shrink-0 z-10 select-none"
      data-testid="message-composer"
      onPaste={handlePaste}
    >
      {/* Banner chế độ trả lời tin nhắn */}
      {replyingMessage && !editingMessage && (
        <div
          className="flex items-center justify-between px-4 py-2 rounded-xl bg-surface-light dark:bg-[#1E2C3A] border-l-4 border-l-brand border border-border-light dark:border-border-dark text-xs text-ink-primary dark:text-ink-primary-dark shadow-xs animate-in fade-in slide-in-from-bottom-1 duration-150"
          data-testid="reply-banner"
        >
          <div className="flex items-center gap-2 truncate">
            <Reply className="w-3.5 h-3.5 text-brand shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-brand text-[11px]">
                Đang trả lời {replyingMessage.sender?.displayName || replyingMessage.sender?.username}
              </span>
              <span className="truncate text-ink-secondary dark:text-ink-secondary-dark text-[11px]">
                {replyingMessage.type === 'IMAGE'
                  ? '📷 [Hình ảnh]'
                  : replyingMessage.type === 'FILE'
                  ? `📎 [Tệp tin: ${replyingMessage.content}]`
                  : replyingMessage.content}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingMessage(null)}
            title="Hủy bỏ trả lời"
            aria-label="Hủy bỏ trả lời"
            className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-ink-muted hover:text-coral transition-colors shrink-0 ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Banner chế độ chỉnh sửa tin nhắn */}
      {editingMessage && (
        <div className="flex items-center justify-between px-4 py-1.5 rounded-xl bg-brand/10 dark:bg-brand/20 border border-brand/30 text-xs text-ink-primary dark:text-ink-primary-dark animate-in fade-in slide-in-from-bottom-1 duration-150">
          <div className="flex items-center gap-2 truncate">
            <Pencil className="w-3.5 h-3.5 text-brand shrink-0" />
            <span className="font-semibold text-brand">Đang chỉnh sửa:</span>
            <span className="truncate italic text-ink-secondary dark:text-ink-secondary-dark">
              {editingMessage.content}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCancelEdit}
            title="Hủy bỏ chỉnh sửa"
            aria-label="Hủy bỏ chỉnh sửa"
            className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-ink-muted hover:text-coral transition-colors shrink-0 ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Dải xem trước ảnh & tệp đính kèm trước khi gửi (Attachment Preview Strip) */}
      {pendingAttachments.length > 0 && (
        <div
          className="flex items-center gap-2.5 p-2 px-3 rounded-2xl bg-white dark:bg-[#1E2C3A] border border-border/80 dark:border-white/10 overflow-x-auto shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-150"
          data-testid="attachment-preview-strip"
        >
          {pendingAttachments.map((att) => (
            <div
              key={att.id}
              className="relative group shrink-0 flex items-center"
              data-testid={`attachment-preview-item-${att.id}`}
            >
              {att.isImage ? (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border/80 dark:border-white/15 bg-black/5 dark:bg-black/20 shadow-xs">
                  <img
                    src={att.previewUrl}
                    alt={att.file.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    title={`Xóa ảnh ${att.file.name}`}
                    aria-label={`Xóa ${att.file.name}`}
                    onClick={() => handleRemoveAttachment(att.id)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer shadow-xs"
                    data-testid="remove-attachment-btn"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="relative flex items-center gap-2 p-2 pr-7 rounded-xl border border-border/80 dark:border-white/15 bg-black/5 dark:bg-white/5 max-w-[200px] shadow-xs">
                  <FileText className="w-6 h-6 text-brand shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium truncate text-ink-primary dark:text-ink-primary-dark">
                      {att.file.name}
                    </span>
                    <span className="text-[10px] text-ink-muted">
                      {formatFileSize(att.file.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    title={`Xóa ${att.file.name}`}
                    aria-label={`Xóa ${att.file.name}`}
                    onClick={() => handleRemoveAttachment(att.id)}
                    className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                    data-testid="remove-attachment-btn"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 w-full">
        {/* Input file ẩn hỗ trợ đa tệp (multiple) */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt"
          className="hidden"
          data-testid="file-upload-input"
        />

        {/* Khung nhập văn bản dạng con nhộng (Pill Capsule) */}
        <div className="flex-1 flex items-end rounded-3xl bg-surface-light dark:bg-[#17212B] px-3.5 py-1.5 border border-border-light/80 dark:border-border-dark shadow-xs focus-within:ring-2 focus-within:ring-brand/30 focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(42,171,238,0.12)] transition-all">
          {/* Nút đính kèm tệp */}
          <button
            type="button"
            aria-label="Đính kèm tệp"
            title={
              isUploading
                ? `Đang tải lên ${uploadPercent}%...`
                : 'Đính kèm tệp hoặc ảnh'
            }
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="p-1.5 text-ink-secondary dark:text-ink-secondary-dark hover:text-brand dark:hover:text-brand-accent hover:bg-brand-soft/50 dark:hover:bg-white/5 rounded-full transition-all duration-150 hover:rotate-12 hover:scale-110 active:scale-90 disabled:opacity-40 mb-0.5 cursor-pointer"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-brand" />
            ) : (
              <Paperclip className="w-5 h-5 transition-transform" />
            )}
          </button>

          {/* Textarea nhập tin nhắn co giãn */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || isUploading}
            placeholder={
              editingMessage
                ? 'Nhập nội dung chỉnh sửa...'
                : pendingAttachments.length > 0
                ? 'Thêm lời bình cho tệp đính kèm (tùy chọn)...'
                : 'Soạn tin nhắn...'
            }
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none text-ink-primary dark:text-ink-primary-dark placeholder:text-ink-muted max-h-[140px] leading-relaxed py-1.5 px-2 select-text"
            aria-label="Nội dung tin nhắn"
          />

          {/* Nút biểu tượng cảm xúc */}
          <button
            type="button"
            aria-label="Chọn biểu tượng cảm xúc"
            title="Biểu tượng cảm xúc"
            disabled={disabled || isUploading}
            onClick={() => setContent((prev) => prev + ' 😊')}
            className="p-1.5 text-ink-secondary dark:text-ink-secondary-dark hover:text-amber-500 dark:hover:text-amber-400 hover:scale-115 active:scale-90 transition-all duration-150 disabled:opacity-40 mb-0.5 cursor-pointer"
          >
            <Smile className="w-5 h-5 transition-transform" />
          </button>
        </div>

        {/* Nút gửi tin nhắn / lưu chỉnh sửa */}
        <button
          type="button"
          aria-label={editingMessage ? 'Lưu chỉnh sửa' : 'Gửi tin nhắn'}
          title={
            editingMessage
              ? 'Lưu chỉnh sửa (Enter)'
              : 'Gửi tin nhắn (Enter)'
          }
          onClick={handleSend}
          disabled={!canSend}
          className="w-11 h-11 rounded-full bg-brand text-white flex items-center justify-center shrink-0 hover:bg-brand-hover hover:scale-105 active:scale-95 transition-all duration-150 shadow-md hover:shadow-brand/25 disabled:opacity-40 disabled:hover:bg-brand disabled:hover:scale-100 disabled:active:scale-100 disabled:shadow-none group cursor-pointer"
        >
          {editingMessage ? (
            <Check className="w-5 h-5 transition-transform duration-150 group-hover:scale-110" />
          ) : (
            <Send className="w-5 h-5 ml-0.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          )}
        </button>
      </div>
    </div>
  )
}
