import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MessageComposer } from './MessageComposer'
import { socketClient } from '@/services/socket.client'

import type { Socket } from 'socket.io-client'

vi.mock('@/services/socket.client', () => ({
  socketClient: {
    getSocket: vi.fn(),
  },
}))

describe('MessageComposer Component Tests', () => {
  const mockSocket = {
    emit: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(socketClient.getSocket).mockReturnValue(mockSocket as unknown as Socket)
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
})
