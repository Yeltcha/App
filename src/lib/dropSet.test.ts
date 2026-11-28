import { describe, expect, it } from 'vitest'
import { dropAnchor, dropWeight, planDropSet, setLabels } from './dropSet'

const set = (id: string, set_number: number, extra: Partial<{ set_kind: string; done: boolean; completed_at: string | null; weight_kg: number; reps: number; rest_sec: number }> = {}) => ({
  id, set_number, set_kind: 'normal', weight_kg: 100, reps: 8, rest_sec: 120, done: false, completed_at: null, ...extra,
})

describe('dropWeight', () => {
  it('retire 20 % arrondi à 2,5 kg', () => {
    expect(dropWeight(100)).toBe(80)
    expect(dropWeight(62.5)).toBe(50)
  })
  it('arrondit à 0,5 kg pour les petites charges', () => {
    expect(dropWeight(8)).toBe(6.5)
  })
})

describe('setLabels', () => {
  it('numérote les séries et rattache les drops à leur série', () => {
    const labels = setLabels([set('a', 1), set('b', 2), set('c', 3, { set_kind: 'drop' }), set('d', 4, { set_kind: 'drop' }), set('e', 5)])
    expect(labels.get('b')).toEqual({ number: 2, drop: null })
    expect(labels.get('c')).toEqual({ number: 2, drop: 1 })
    expect(labels.get('d')).toEqual({ number: 2, drop: 2 })
    expect(labels.get('e')).toEqual({ number: 3, drop: null })
  })
})

describe('dropAnchor', () => {
  it('prend la dernière série cochée', () => {
    const group = [
      set('a', 1, { done: true, completed_at: '2026-11-28T10:00:00Z' }),
      set('b', 2, { done: true, completed_at: '2026-11-28T10:05:00Z' }),
      set('c', 3),
    ]
    expect(dropAnchor(group)?.id).toBe('b')
  })
  it('remonte à la série mère quand le dernier coché est un drop', () => {
    const group = [
      set('a', 1, { done: true, completed_at: '2026-11-28T10:00:00Z' }),
      set('b', 2, { set_kind: 'drop', done: true, completed_at: '2026-11-28T10:01:00Z' }),
    ]
    expect(dropAnchor(group)?.id).toBe('a')
  })
  it('sans série cochée, prend la prochaine à faire', () => {
    expect(dropAnchor([set('a', 1), set('b', 2)])?.id).toBe('a')
  })
})

describe('planDropSet', () => {
  it('insère après la chaîne, décale la suite et garde le repos pour la fin', () => {
    const group = [set('a', 1), set('b', 2, { set_kind: 'drop', weight_kg: 80 }), set('c', 3)]
    const plan = planDropSet(group, group[0])
    expect(plan.chainEnd.id).toBe('b')
    expect(plan.drop).toEqual({ set_number: 3, weight_kg: 65, reps: 8, rest_sec: 120 })
    expect(plan.renumber).toEqual([{ id: 'c', set_number: 4 }])
  })
})
