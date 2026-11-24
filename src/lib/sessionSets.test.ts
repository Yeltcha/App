import { describe, expect, it } from 'vitest'
import { groupByExercise } from './sessionSets'

describe('groupByExercise', () => {
  it('regroupe par position et garde l’ordre de la séance', () => {
    const sets = [{ exercise_position: 1, n: 'b1' }, { exercise_position: 0, n: 'a1' }, { exercise_position: 1, n: 'b2' }]
    expect(groupByExercise(sets).map(([p, g]) => `${p}:${g.map((s) => s.n).join(',')}`)).toEqual(['0:a1', '1:b1,b2'])
  })
})
