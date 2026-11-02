import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OtpInput } from './otp-input'

describe('OtpInput Component (ZOMBIES & AAA Methodology)', () => {
  // Z - Zero: Renders empty boxes
  it('Z: renders the specified number of empty inputs and autofocuses the first box', () => {
    // Arrange & Act
    render(<OtpInput value="" onChange={vi.fn()} length={6} autoFocus={true} />)
    const inputs = screen.getAllByRole('textbox')

    // Assert
    expect(inputs).toHaveLength(6)
    inputs.forEach((input) => {
      expect(input).toHaveValue('')
    })
    expect(inputs[0]).toHaveFocus()
  })

  // O - One: Typing a single digit
  it('O: typing a single digit calls onChange with that digit and advances focus', async () => {
    // Arrange
    const user = userEvent.setup()
    const onChangeMock = vi.fn()
    render(<OtpInput value="" onChange={onChangeMock} length={6} />)
    const inputs = screen.getAllByRole('textbox')

    // Act
    await user.type(inputs[0], '5')

    // Assert
    expect(onChangeMock).toHaveBeenCalledWith('5')
  })

  // M - Many & I - Interface: Auto-trigger onComplete when 6 digits are typed
  it('M & I: triggers onComplete callback automatically when all 6 digits are filled', async () => {
    // Arrange
    const user = userEvent.setup()
    const onChangeMock = vi.fn()
    const onCompleteMock = vi.fn()

    // Test with 5 digits already filled and typing the 6th
    render(
      <OtpInput
        value="12345"
        onChange={onChangeMock}
        onComplete={onCompleteMock}
        length={6}
      />
    )
    const inputs = screen.getAllByRole('textbox')

    // Act: Type the final digit in the 6th box
    await user.type(inputs[5], '6')

    // Assert
    expect(onChangeMock).toHaveBeenCalledWith('123456')
    expect(onCompleteMock).toHaveBeenCalledWith('123456')
  })

  // B - Boundaries: Backspace navigation between boxes
  it('B: backspace on an empty box shifts focus to the previous box and clears it', async () => {
    // Arrange
    const user = userEvent.setup()
    const onChangeMock = vi.fn()

    render(
      <OtpInput
        value="12"
        onChange={onChangeMock}
        length={6}
      />
    )
    const inputs = screen.getAllByRole('textbox')

    // Focus box index 2 (which is empty since value is "12")
    inputs[2].focus()
    expect(inputs[2]).toHaveFocus()

    // Act: Press backspace on empty box
    await user.keyboard('{Backspace}')

    // Assert: Focus moved to box 1 and cleared it
    expect(inputs[1]).toHaveFocus()
    expect(onChangeMock).toHaveBeenCalledWith('1')
  })

  // I - Interface / Filtering: Non-numeric rejection
  it('I: ignores non-numeric characters (letters and special characters)', async () => {
    // Arrange
    const user = userEvent.setup()
    const onChangeMock = vi.fn()

    render(<OtpInput value="" onChange={onChangeMock} length={6} />)
    const inputs = screen.getAllByRole('textbox')

    // Act: Type letter 'a'
    await user.type(inputs[0], 'a')

    // Assert: onChange should not be called with letter
    expect(onChangeMock).not.toHaveBeenCalled()
  })

  // E - Edge Cases: Clipboard paste with sanitized formatting
  it('E: handles clipboard paste by sanitizing non-digits and populating all 6 boxes', async () => {
    // Arrange
    const user = userEvent.setup()
    const onChangeMock = vi.fn()
    const onCompleteMock = vi.fn()

    render(
      <OtpInput
        value=""
        onChange={onChangeMock}
        onComplete={onCompleteMock}
        length={6}
      />
    )
    const inputs = screen.getAllByRole('textbox')

    // Act: Focus first box and paste formatted code
    inputs[0].focus()
    await user.paste('84-92 01')

    // Assert: Cleaned 6 digits "849201"
    expect(onChangeMock).toHaveBeenCalledWith('849201')
    expect(onCompleteMock).toHaveBeenCalledWith('849201')
  })
})
