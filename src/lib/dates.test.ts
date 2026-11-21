import { beforeAll, describe, expect, it } from 'vitest'
import { daysBetween, ensureTemporal, formatClock, formatDuration } from './dates'

beforeAll(ensureTemporal)

describe('dates', () => {
  it('formate une durée en heures et minutes', () => {
    expect(formatDuration(0, 65 * 60_000)).toMatch(/1\s?h.*5\s?min/)
    expect(formatDuration(0, 20_000)).toBe('< 1 min')
  })
  it('formate le minuteur de repos', () => {
    expect(formatClock(90)).toBe('1:30')
    expect(formatClock(4.2)).toBe('0:05')
    expect(formatClock(-3)).toBe('0:00')
  })
  it('compte les jours entre deux dates', () => {
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2)
  })
})
