import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DateDivider } from './DateDivider'
import { formatDateDivider } from '../utils/format-message'

describe('DateDivider Component & Format Tests', () => {
  it('formats today as "Hôm nay"', () => {
    const today = new Date()
    expect(formatDateDivider(today)).toBe('Hôm nay')

    render(<DateDivider date={today} />)
    expect(screen.getByText('Hôm nay')).toBeInTheDocument()
  })

  it('formats yesterday as "Hôm qua"', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(formatDateDivider(yesterday)).toBe('Hôm qua')

    render(<DateDivider date={yesterday} />)
    expect(screen.getByText('Hôm qua')).toBeInTheDocument()
  })

  it('formats date in the same year as "d tháng M"', () => {
    // Current year, but distinct month/day
    const now = new Date()
    const someDay = new Date(now.getFullYear(), 2, 15) // March 15th
    expect(formatDateDivider(someDay)).toBe('15 tháng 3')

    render(<DateDivider date={someDay} />)
    expect(screen.getByText('15 tháng 3')).toBeInTheDocument()
  })

  it('formats date in a past year as "d tháng M, yyyy"', () => {
    const pastYearDate = new Date(2023, 11, 25) // Dec 25, 2023
    expect(formatDateDivider(pastYearDate)).toBe('25 tháng 12, 2023')

    render(<DateDivider date={pastYearDate} />)
    expect(screen.getByText('25 tháng 12, 2023')).toBeInTheDocument()
  })

  it('renders nothing for invalid date', () => {
    const { container } = render(<DateDivider date="invalid-date" />)
    expect(container.firstChild).toBeNull()
  })
})
