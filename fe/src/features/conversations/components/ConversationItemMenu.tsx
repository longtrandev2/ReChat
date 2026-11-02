import { useState } from 'react'
import { MoreHorizontal, Pin, PinOff, Trash2, Ban, ShieldCheck } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useConversationActions } from '@/features/chat/hooks/useConversationActions'
import {
  BlockUserConfirmDialog,
  ClearHistoryConfirmDialog,
} from '@/features/chat/components/ConversationConfirmDialogs'
import type { Conversation } from '../types/conversation.types'

const ITEM_CLASS =
  'flex items-center gap-2 px-2.5 py-2 rounded-lg text-ink-primary dark:text-ink-primary-dark data-[highlighted]:bg-surface-hover dark:data-[highlighted]:bg-white/5 cursor-pointer focus:outline-hidden font-medium text-sm'
const DANGER_ITEM_CLASS =
  'flex items-center gap-2 px-2.5 py-2 rounded-lg text-coral dark:text-rose-400 data-[highlighted]:bg-coral-soft/50 cursor-pointer focus:outline-hidden font-medium text-sm'

/**
 * ConversationItemMenu: nút "⋯" trên mỗi hàng inbox, dùng chung hành động với menu header (FR-48):
 * ghim/bỏ ghim, xóa đoạn chat, chặn/bỏ chặn (chỉ DIRECT, ẩn "Chặn" khi mình bị chặn - BR-38).
 */
export function ConversationItemMenu({ conversation }: { conversation: Conversation }) {
  const actions = useConversationActions(conversation)
  const [isClearOpen, setIsClearOpen] = useState(false)
  const [isBlockOpen, setIsBlockOpen] = useState(false)
  const isDirect = conversation.type === 'DIRECT'
  const { blockStatus } = actions

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Tùy chọn hội thoại"
            data-testid={`conversation-menu-${conversation.id}`}
            className="p-1 rounded-md bg-surface-light dark:bg-surface-dark hover:bg-black/10 dark:hover:bg-white/10 text-ink-secondary hover:text-ink-primary dark:hover:text-white cursor-pointer"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-44 p-1 rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-[#17212B] shadow-lg"
          >
            <DropdownMenu.Item
              className={ITEM_CLASS}
              onSelect={() => void actions.togglePin()}
              data-testid="conversation-menu-pin"
            >
              {actions.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              <span>{actions.isPinned ? 'Bỏ ghim' : 'Ghim đoạn chat'}</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className={ITEM_CLASS} onSelect={() => setIsClearOpen(true)}>
              <Trash2 className="w-4 h-4" />
              <span>Xóa đoạn chat</span>
            </DropdownMenu.Item>
            {isDirect && blockStatus === 'BLOCKED_BY_ME' && (
              <DropdownMenu.Item className={ITEM_CLASS} onSelect={() => void actions.unblockPartner()}>
                <ShieldCheck className="w-4 h-4" />
                <span>Bỏ chặn</span>
              </DropdownMenu.Item>
            )}
            {isDirect && blockStatus === 'NONE' && (
              <DropdownMenu.Item className={DANGER_ITEM_CLASS} onSelect={() => setIsBlockOpen(true)}>
                <Ban className="w-4 h-4" />
                <span>Chặn người dùng</span>
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <ClearHistoryConfirmDialog
        open={isClearOpen}
        onOpenChange={setIsClearOpen}
        onConfirm={actions.clearHistory}
        isLoading={actions.isClearing}
      />
      <BlockUserConfirmDialog
        open={isBlockOpen}
        onOpenChange={setIsBlockOpen}
        name={conversation.name}
        onConfirm={actions.blockPartner}
        isLoading={actions.isBlocking}
      />
    </>
  )
}
