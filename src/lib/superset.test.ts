import { describe, expect, it } from 'vitest'
import { restsAfter, sessionSupersets, slotLabel, supersetSlots } from './superset'

const list = (...flags: boolean[]) => flags.map((superset_with_previous) => ({ superset_with_previous }))

describe('supersetSlots', () => {
  it('exercices seuls', () => {
    expect(supersetSlots(list(false, false))).toEqual([null, null])
  })
  it('le premier exercice ne peut pas être lié', () => {
    expect(supersetSlots(list(true, false))).toEqual([null, null])
  })
  it('A1/A2 puis B1/B2/B3, exercice seul entre les deux', () => {
    const slots = supersetSlots(list(false, true, false, false, true, true))
    expect(slots.map((s) => (s ? slotLabel(s) : '-'))).toEqual(['A1', 'A2', '-', 'B1', 'B2', 'B3'])
    expect(slots[4]).toEqual({ group: 3, letter: 'B', order: 2, size: 3 })
  })
})

describe('sessionSupersets', () => {
  it('regroupe par numéro et ignore un groupe d’un seul exercice', () => {
    const map = sessionSupersets([
      { position: 0, group: 0 }, { position: 1, group: 0 }, { position: 2, group: null }, { position: 3, group: 3 },
    ])
    expect([...map.entries()].map(([p, s]) => `${p}:${slotLabel(s)}`)).toEqual(['0:A1', '1:A2'])
  })
})

describe('restsAfter', () => {
  it('repos seulement après le dernier exercice du superset', () => {
    const [a1, a2] = supersetSlots(list(false, true))
    expect(restsAfter(a1)).toBe(false)
    expect(restsAfter(a2)).toBe(true)
    expect(restsAfter(null)).toBe(true)
  })
})
