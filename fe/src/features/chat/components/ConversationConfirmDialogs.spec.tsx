import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BlockUserConfirmDialog } from './ConversationConfirmDialogs'

describe('ConversationConfirmDialogs', () => {
  it('closes the dialog even when the server rejects the action (BR-38)', async () => {
    const onOpenChange = vi.fn()
    const onConfirm = vi.fn().mockResolvedValue(false)
    render(<BlockUserConfirmDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} name="Bob" />)

    fireEvent.click(screen.getByTestId('confirm-block-user-submit'))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
