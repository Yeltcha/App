import { describe, expect, it } from 'vitest'
import { restsAfter, sessionSupersets, slotLabel, splitSuperset, supersetSlots } from './superset'

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

describe('splitSuperset', () => {
  const ex = [
    { position: 0, group: 0 },
    { position: 1, group: 0 },
    { position: 2, group: 0 },
    { position: 3, group: null },
  ]
  it('détache la fin du superset dans un nouveau groupe', () => {
    expect(splitSuperset(ex, 0)).toEqual({ positions: [1, 2], group: 1 })
    expect(splitSuperset(ex, 1)).toEqual({ positions: [2], group: 1 })
  })
  it('ne fait rien sans lien avec l’exercice suivant', () => {
    expect(splitSuperset(ex, 2)).toBeNull()
    expect(splitSuperset(ex, 3)).toBeNull()
  })
  it('après le découpage, les morceaux d’un seul exercice redeviennent seuls', () => {
    const split = splitSuperset(ex, 1)!
    const after = ex.map((e) => (split.positions.includes(e.position) ? { ...e, group: split.group } : e))
    const slots = sessionSupersets(after)
    expect(slots.get(0)?.size).toBe(2)
    expect(slots.get(2)).toBeUndefined()
  })
})
