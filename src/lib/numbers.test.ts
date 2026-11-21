import { describe, expect, it } from 'vitest'
import { average, estimate1RM, parseDecimal } from './numbers'

describe('parseDecimal', () => {
  it('accepte la virgule et le point', () => {
    expect(parseDecimal('62,5')).toBe(62.5)
    expect(parseDecimal('62.5')).toBe(62.5)
    expect(parseDecimal(' 100 ')).toBe(100)
  })
  it('rejette les saisies invalides', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('-5')).toBeNull()
    expect(parseDecimal('1,2,3')).toBeNull()
  })
})

describe('estimate1RM', () => {
  it('applique la formule d’Epley', () => {
    expect(estimate1RM(100, 5)).toBe(116.7)
    expect(estimate1RM(105, 5)).toBe(122.5)
  })
  it('renvoie la charge pour une seule répétition', () => {
    expect(estimate1RM(140, 1)).toBe(140)
  })
  it('ignore les séries trop longues ou vides', () => {
    expect(estimate1RM(50, 15)).toBeNull()
    expect(estimate1RM(0, 5)).toBeNull()
  })
})

describe('average', () => {
  it('calcule la moyenne', () => {
    expect(average([1, 2, 3])).toBe(2)
    expect(average([])).toBeNull()
  })
})
