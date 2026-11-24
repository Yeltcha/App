import { describe, expect, it } from 'vitest'
import { loadFromRpe, percentOf1RM, rirFor, roundLoad } from './rpe'

describe('percentOf1RM', () => {
  it('reprend la table de référence', () => {
    expect(percentOf1RM(1, 10)).toBe(100)
    expect(percentOf1RM(5, 8)).toBe(81.1)
    expect(percentOf1RM(3, 9.5)).toBe(90.7)
    expect(percentOf1RM(12, 6)).toBe(57.2)
    expect(percentOf1RM(10, 9.5)).toBe(72.3)
  })
  it('lie RPE et RIR : 5 reps à RPE 8 = 7 reps à RPE 10', () => {
    expect(rirFor(8)).toBe(2)
    expect(percentOf1RM(5, 8)).toBe(percentOf1RM(7, 10))
  })
  it('refuse ce qui sort de la table', () => {
    expect(percentOf1RM(0, 8)).toBeNull()
    expect(percentOf1RM(13, 8)).toBeNull()
    expect(percentOf1RM(5, 5.5)).toBeNull()
    expect(percentOf1RM(5, 8.25)).toBeNull()
  })
})

describe('loadFromRpe', () => {
  it('calcule et arrondit la charge à 2,5 kg', () => {
    // 140 × 81,1 % = 113,54 → 112,5
    expect(loadFromRpe(140, 5, 8)).toEqual({ kg: 112.5, percent: 81.1, rir: 2 })
    expect(loadFromRpe(100, 1, 10)?.kg).toBe(100)
  })
  it('sans 1RM, pas de charge', () => {
    expect(loadFromRpe(0, 5, 8)).toBeNull()
  })
})

describe('roundLoad', () => {
  it('arrondit au palier', () => {
    expect(roundLoad(113.54)).toBe(112.5)
    expect(roundLoad(113.8)).toBe(115)
    expect(roundLoad(21.3, 1)).toBe(21)
  })
})
