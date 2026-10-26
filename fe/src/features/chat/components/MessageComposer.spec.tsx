import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MessageComposer } from './MessageComposer'
import { socketClient } from '@/services/socket.client'
import { mediaApi } from '../services/media.api'
import { useMessagesStore } from '../stores/messages.store'

import type { Socket } from 'socket.io-client'

vi.mock('@/services/socket.client', () => ({
  socketClient: {
    getSocket: vi.fn(),
  },
}))

vi.mock('../services/media.api', () => ({
  mediaApi: {
    uploadMedia: vi.fn(),
  },
}))

describe('MessageComposer Component Tests', () => {
  const mockSocket = {
    emit: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(socketClient.getSocket).mockReturnValue(mockSocket as unknown as Socket)
    useMessagesStore.getState().setEditingMessage(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders input field with Send button initially disabled', () => {
    render(<MessageComposer conversationId="conv-1" onSendMessage={vi.fn()} />)

    const textarea = screen.getByLabelText('Nội dung tin nhắn')
    const sendButton = screen.getByRole('button', { name: 'Gửi tin nhắn' })

    expect(textarea).toBeInTheDocument()
    expect(sendButton).toBeDisabled()
  })

  it('enables send button when user types valid text', () => {
    render(<MessageComposer conversationId="conv-1" onSendMessage={vi.fn()} />)

    const textarea = screen.getByLabelText('Nội dung tin nhắn')
    fireEvent.change(textarea, { target: { value: 'Chào bạn' } })

    const sendButton = screen.getByRole('button', { name: 'Gửi tin nhắn' })
    expect(sendButton).not.toBeDisabled()
  })

  it('calls onSendMessage and clears input when clicking send', async () => {
    const onSend = vi.fn()
    render(<MessageComposer conversationId="conv-1" onSendMessage={onSend} />)

    const textarea = screen.getByLabelText('Nội dung tin nhắn')
    fireEvent.change(textarea, { target: { value: 'Tin nhắn gửi đi' } })

    const sendButton = screen.getByRole('button', { name: 'Gửi tin nhắn' })
    await act(async () => {
      fireEvent.click(sendButton)
    })

    expect(onSend).toHaveBeenCalledWith('Tin nhắn gửi đi')
    expect(textarea).toHaveValue('')
  })

  it('sends message on Enter key press without Shift', async () => {
    const onSend = vi.fn()
    render(<MessageComposer conversationId="conv-1" onSendMessage={onSend} />)

    const textarea = screen.getByLabelText('Nội dung tin nhắn')
    fireEvent.change(textarea, { target: { value: 'Gửi bằng Enter' } })
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    })

    expect(onSend).toHaveBeenCalledWith('Gửi bằng Enter')
    expect(textarea).toHaveValue('')
  })

  it('does NOT send message on Shift+Enter (allows newline)', () => {
    const onSend = vi.fn()
    render(<MessageComposer conversationId="conv-1" onSendMessage={onSend} />)

    const textarea = screen.getByLabelText('Nội dung tin nhắn')
    fireEvent.change(textarea, { target: { value: 'Dòng 1' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    expect(onSend).not.toHaveBeenCalled()
  })

  it('emits typing event on text change and auto-emits stop typing after timeout', () => {
    vi.useFakeTimers()
    render(<MessageComposer conversationId="conv-1" onSendMessage={vi.fn()} />)

    const textarea = screen.getByLabelText('Nội dung tin nhắn')
    fireEvent.change(textarea, { target: { value: 'Đang gõ' } })

    // Typing start emitted
    expect(mockSocket.emit).toHaveBeenCalledWith('typing', {
      conversationId: 'conv-1',
      isTyping: true,
    })

    // Advance 2500ms
    vi.advanceTimersByTime(2500)

    // Typing stop emitted
    expect(mockSocket.emit).toHaveBeenCalledWith('typing', {
      conversationId: 'conv-1',
      isTyping: false,
    })
  })

  it('triggers mediaApi.uploadMedia when file input is changed', async () => {
    vi.mocked(mediaApi.uploadMedia).mockResolvedValueOnce({
      public_id: 'mock-id',
      secure_url: 'https://cloudinary.com/test.png',
    })

    render(<MessageComposer conversationId="conv-1" onSendMessage={vi.fn()} />)

    const fileInput = screen.getByTestId('file-upload-input')
    const file = new File(['dummy content'], 'photo.jpg', { type: 'image/jpeg' })

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } })
    })

    expect(mediaApi.uploadMedia).toHaveBeenCalledTimes(1)
    expect(mediaApi.uploadMedia).toHaveBeenCalledWith(
      file,
      'conv-1',
      expect.any(Function)
    )
  })

  it('enters edit mode, displays edit banner, and triggers onEditMessage on save', async () => {
    const onEdit = vi.fn()
    useMessagesStore.getState().setEditingMessage({ id: 'msg-edit-1', content: 'Nội dung ban đầu' })

    render(
      <MessageComposer
        conversationId="conv-1"
        onSendMessage={vi.fn()}
        onEditMessage={onEdit}
      />
    )

    // Edit banner displayed
    expect(screen.getByText('Đang chỉnh sửa:')).toBeInTheDocument()
    expect(screen.getAllByText('Nội dung ban đầu')).toHaveLength(2)

    const textarea = screen.getByLabelText('Nội dung tin nhắn')
    expect(textarea).toHaveValue('Nội dung ban đầu')

    fireEvent.change(textarea, { target: { value: 'Nội dung đã được sửa' } })

    const saveButton = screen.getByRole('button', { name: 'Lưu chỉnh sửa' })
    await act(async () => {
      fireEvent.click(saveButton)
    })

    expect(onEdit).toHaveBeenCalledWith('msg-edit-1', 'Nội dung đã được sửa')
    expect(useMessagesStore.getState().editingMessage).toBeNull()
  })

  it('cancels edit mode when clicking cancel button on banner', async () => {
    useMessagesStore.getState().setEditingMessage({ id: 'msg-edit-1', content: 'Nội dung ban đầu' })

    render(<MessageComposer conversationId="conv-1" onSendMessage={vi.fn()} />)

    const cancelBtn = screen.getByRole('button', { name: 'Hủy bỏ chỉnh sửa' })
    fireEvent.click(cancelBtn)

    expect(useMessagesStore.getState().editingMessage).toBeNull()
    expect(screen.queryByText('Đang chỉnh sửa:')).not.toBeInTheDocument()
  })

  it('displays reply banner and sends message with replyToId', async () => {
    const onSend = vi.fn()
    const mockReplyingMsg = {
      id: 'parent-msg-123',
      content: 'Tin nhắn gốc cần trả lời',
      type: 'TEXT' as const,
      fileUrl: null,
      replyToId: null,
      isRecalled: false,
      createdAt: '2026-10-26T10:00:00.000Z',
      updatedAt: '2026-10-26T10:00:00.000Z',
      sender: {
        id: 'user-bob',
        username: 'bob',
        displayName: 'Bob Trần',
        avatarUrl: null,
      },
    }

    useMessagesStore.getState().setReplyingMessage(mockReplyingMsg)

    render(<MessageComposer conversationId="conv-1" onSendMessage={onSend} />)

    // Verify reply banner displays sender and quote
    expect(screen.getByTestId('reply-banner')).toBeInTheDocument()
    expect(screen.getByText('Đang trả lời Bob Trần')).toBeInTheDocument()
    expect(screen.getByText('Tin nhắn gốc cần trả lời')).toBeInTheDocument()

    // Type reply message and send
    const textarea = screen.getByLabelText('Nội dung tin nhắn')
    fireEvent.change(textarea, { target: { value: 'Đây là câu trả lời của tôi' } })

    const sendButton = screen.getByRole('button', { name: 'Gửi tin nhắn' })
    await act(async () => {
      fireEvent.click(sendButton)
    })

    expect(onSend).toHaveBeenCalledWith('Đây là câu trả lời của tôi', 'parent-msg-123')
    expect(useMessagesStore.getState().replyingMessage).toBeNull()
    expect(screen.queryByTestId('reply-banner')).not.toBeInTheDocument()
  })

  it('cancels reply mode when clicking cancel button on reply banner', () => {
    const mockReplyingMsg = {
      id: 'parent-msg-123',
      content: 'Tin nhắn gốc',
      type: 'TEXT' as const,
      fileUrl: null,
      replyToId: null,
      isRecalled: false,
      createdAt: '2026-10-26T10:00:00.000Z',
      updatedAt: '2026-10-26T10:00:00.000Z',
      sender: {
        id: 'user-bob',
        username: 'bob',
        displayName: 'Bob Trần',
        avatarUrl: null,
      },
    }

    useMessagesStore.getState().setReplyingMessage(mockReplyingMsg)

    render(<MessageComposer conversationId="conv-1" onSendMessage={vi.fn()} />)

    const cancelBtn = screen.getByRole('button', { name: 'Hủy bỏ trả lời' })
    fireEvent.click(cancelBtn)

    expect(useMessagesStore.getState().replyingMessage).toBeNull()
    expect(screen.queryByTestId('reply-banner')).not.toBeInTheDocument()
  })
})

