import { useRef, useState, type ChangeEvent } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getApiErrorMessage } from '@/lib/utils'
import { settingsApi } from '../services/settings.api'
import { AVATAR_ACCEPTED_TYPES, validateAvatarFile } from '../schemas/settings.schema'
import { patchAuthUser } from '../utils/patch-auth-user'

interface AvatarUploaderProps {
  avatarUrl?: string
  displayName: string
}

/**
 * AvatarUploader: avatar 96px + nút máy ảnh overlay.
 * Chọn ảnh -> upload Cloudinary (POST /media/upload) -> lưu URL (PATCH /users/me) -> đồng bộ useAuthStore.
 */
export function AvatarUploader({ avatarUrl, displayName }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const initials = (displayName || 'U').slice(0, 2).toUpperCase()

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset để chọn lại cùng 1 file vẫn kích hoạt onChange
    event.target.value = ''
    if (!file) return

    const validationError = validateAvatarFile(file)
    if (validationError) {
      toast.error(validationError)
      return
    }

    try {
      setIsUploading(true)
      const url = await settingsApi.uploadAvatar(file)
      const updated = await settingsApi.updateProfile({ avatarUrl: url })
      patchAuthUser({ avatarUrl: updated.avatarUrl ?? url })
      toast.success('Đã cập nhật ảnh đại diện')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể tải ảnh đại diện lên. Vui lòng thử lại.'))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="relative w-24 h-24 shrink-0">
      <Avatar className="w-24 h-24 text-2xl ring-4 ring-brand-soft dark:ring-brand/20">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
        <AvatarFallback className="bg-brand-soft text-brand font-semibold">{initials}</AvatarFallback>
      </Avatar>

      {isUploading && (
        <div
          className="absolute inset-0 rounded-full bg-black/45 flex items-center justify-center"
          data-testid="avatar-uploading"
        >
          <Loader2 className="w-7 h-7 text-white animate-spin" />
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        aria-label="Đổi ảnh đại diện"
        className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-brand text-white shadow-telegram flex items-center justify-center border-2 border-white dark:border-[#17212B] hover:bg-brand-hover transition-colors disabled:opacity-60 cursor-pointer"
      >
        <Camera className="w-4 h-4" />
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={handleFileChange}
        data-testid="avatar-file-input"
      />
    </div>
  )
}
