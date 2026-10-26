import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WelcomeEmptyCanvas } from './WelcomeEmptyCanvas'

describe('WelcomeEmptyCanvas Component Tests', () => {
  it('renders empty canvas with accessible region and Telegram-style prompt', () => {
    render(<WelcomeEmptyCanvas />)

    // Accessible container
    const region = screen.getByRole('region', { name: 'Khu vực trò chuyện trống' })
    expect(region).toBeInTheDocument()

    // Heading
    expect(
      screen.getByRole('heading', { level: 2, name: 'Chọn một cuộc trò chuyện' })
    ).toBeInTheDocument()

    // Description text
    expect(
      screen.getByText(/chọn một người bạn hoặc nhóm chat từ danh sách để bắt đầu gửi tin nhắn/i)
    ).toBeInTheDocument()

    // Gateway status badge
    expect(screen.getByText('Cổng kết nối thời gian thực đã sẵn sàng')).toBeInTheDocument()
  })
})
