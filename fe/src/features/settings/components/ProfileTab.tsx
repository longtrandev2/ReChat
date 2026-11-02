import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { CheckCircle2, Loader2, UserRound, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/utils'
import type { UserProfile } from '@/types/auth.types'
import { settingsApi } from '../services/settings.api'
import { displayNameSchema, type DisplayNameFormData } from '../schemas/settings.schema'
import { patchAuthUser } from '../utils/patch-auth-user'
import { AvatarUploader } from './AvatarUploader'
import { ChangePasswordCard } from './ChangePasswordCard'
import { SettingsCard } from './SettingsCard'

interface ProfileTabProps {
  user: UserProfile
}

/**
 * ProfileTab: Hồ sơ cá nhân (avatar, tên hiển thị, thông tin tài khoản) + Form đổi mật khẩu
 */
export function ProfileTab({ user }: ProfileTabProps) {
  const displayName = user.displayName || user.username

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DisplayNameFormData>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: { displayName },
  })

  const onSubmit = async (data: DisplayNameFormData) => {
    try {
      const updated = await settingsApi.updateProfile({ displayName: data.displayName })
      const savedName = updated.displayName ?? data.displayName
      patchAuthUser({ displayName: savedName })
      reset({ displayName: savedName })
      toast.success('Đã cập nhật tên hiển thị')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể cập nhật tên hiển thị'))
    }
  }

  const memberSince = user.createdAt ? format(new Date(user.createdAt), 'dd/MM/yyyy') : null

  return (
    <div className="space-y-5" data-testid="profile-tab">
      <SettingsCard title="Hồ sơ cá nhân" description="Ảnh đại diện và tên hiển thị với mọi người trên ReChat" icon={<UserRound className="w-4.5 h-4.5" />}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <AvatarUploader avatarUrl={user.avatarUrl} displayName={displayName} />

          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 space-y-3" noValidate>
            <div className="space-y-1">
              <label
                htmlFor="displayName"
                className="block text-xs font-semibold text-ink-secondary dark:text-ink-secondary-dark uppercase tracking-wider"
              >
                Tên hiển thị
              </label>
              <Input
                id="displayName"
                maxLength={50}
                disabled={isSubmitting}
                error={Boolean(errors.displayName)}
                {...register('displayName')}
              />
              {errors.displayName && (
                <p className="text-xs text-coral mt-1" role="alert">
                  {errors.displayName.message}
                </p>
              )}
            </div>
            <Button type="submit" size="sm" disabled={isSubmitting || !isDirty} className="gap-1.5">
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Lưu thay đổi
            </Button>
          </form>
        </div>

        <dl className="mt-6 pt-5 border-t border-border/60 dark:border-border-dark grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs text-ink-muted uppercase tracking-wider font-semibold">Tên đăng nhập</dt>
            <dd className="mt-1 text-ink-primary dark:text-ink-primary-dark font-medium">@{user.username}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-ink-muted uppercase tracking-wider font-semibold">Email</dt>
            <dd className="mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-ink-primary dark:text-ink-primary-dark font-medium truncate">
                {user.email || 'Chưa có email'}
              </span>
              {user.email &&
                (user.isEmailVerified ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-presence-online bg-presence-online/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Đã xác thực
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-secondary bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full">
                    <AlertCircle className="w-3 h-3" /> Chưa xác thực
                  </span>
                ))}
            </dd>
          </div>
          {memberSince && (
            <div>
              <dt className="text-xs text-ink-muted uppercase tracking-wider font-semibold">Thành viên từ</dt>
              <dd className="mt-1 text-ink-primary dark:text-ink-primary-dark font-medium">{memberSince}</dd>
            </div>
          )}
        </dl>
      </SettingsCard>

      <ChangePasswordCard />
    </div>
  )
}
