import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ImageLightboxModal } from './ImageLightboxModal'

describe('ImageLightboxModal', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ImageLightboxModal
        isOpen={false}
        imageUrl="https://example.com/test.jpg"
        onClose={vi.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders image and controls when isOpen is true', () => {
    const handleClose = vi.fn()
    render(
      <ImageLightboxModal
        isOpen={true}
        imageUrl="https://example.com/test.jpg"
        altText="Ảnh chụp màn hình"
        onClose={handleClose}
      />
    )

    expect(screen.getByTestId('image-lightbox-modal')).toBeInTheDocument()
    expect(screen.getByText('Ảnh chụp màn hình')).toBeInTheDocument()
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/test.jpg')

    // Close button click
    const closeBtn = screen.getByRole('button', { name: 'Đóng' })
    fireEvent.click(closeBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape key press', () => {
    const handleClose = vi.fn()
    render(
      <ImageLightboxModal
        isOpen={true}
        imageUrl="https://example.com/test.jpg"
        onClose={handleClose}
      />
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
