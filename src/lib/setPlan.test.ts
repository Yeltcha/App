import { describe, expect, it } from 'vitest'
import { describeSet, plannedSetLoad, plannedSets, rampRpe, type PlannedSet } from './setPlan'

const base = { target_sets: 3, rep_min: 5, rep_max: null, target_rpe: 8, target_weight_kg: null, set_plan: null }
const max = { kg: 140, source: 'test' as const, date: '2026-11-01' }

describe('plannedSets', () => {
  it('sans plan, répète la même série', () => {
    const sets = plannedSets(base)
    expect(sets).toHaveLength(3)
    expect(sets[2]).toEqual({ kind: 'normal', rep_min: 5, rep_max: null, target_rpe: 8, target_weight_kg: null })
  })
  it('avec un plan, reprend chaque série', () => {
    const sets = plannedSets({ ...base, set_plan: [
      { kind: 'top', rep_min: 1, rep_max: null, target_rpe: 9, target_weight_kg: null },
      { kind: 'backoff', rep_min: 5, rep_max: 6, target_rpe: 7, target_weight_kg: null },
    ] })
    expect(sets.map((s) => s.kind)).toEqual(['top', 'backoff'])
    expect(sets[1].rep_max).toBe(6)
  })
})

describe('plannedSetLoad', () => {
  const set: PlannedSet = { kind: 'top', rep_min: 1, rep_max: null, target_rpe: 9, target_weight_kg: null }
  it('calcule la charge de chaque série au RPE', () => {
    // 1 rep à RPE 9 = 95,5 % de 140 = 133,7 → 132,5
    expect(plannedSetLoad(set, 'force', max)).toBe(132.5)
    expect(plannedSetLoad({ ...set, rep_min: 5, target_rpe: 7 }, 'force', max)).toBe(110)
  })
  it('une charge fixée reste prioritaire, pas de charge en cardio', () => {
    expect(plannedSetLoad({ ...set, target_weight_kg: 120 }, 'force', max)).toBe(120)
    expect(plannedSetLoad(set, 'cardio', max)).toBeNull()
    expect(plannedSetLoad(set, 'force', undefined)).toBeNull()
  })
})

describe('rampRpe', () => {
  it('monte de 0,5 par série depuis la première, échauffements exclus', () => {
    const sets = [
      { kind: 'warmup' as const, target_rpe: null },
      { kind: 'normal' as const, target_rpe: 7 },
      { kind: 'normal' as const, target_rpe: null },
      { kind: 'normal' as const, target_rpe: null },
    ]
    expect(rampRpe(sets).map((s) => s.target_rpe)).toEqual([null, 7, 7.5, 8])
  })
  it('plafonne à 10', () => {
    const sets = Array.from({ length: 4 }, () => ({ kind: 'normal' as const, target_rpe: 9 }))
    expect(rampRpe(sets).map((s) => s.target_rpe)).toEqual([9, 9.5, 10, 10])
  })
})

describe('describeSet', () => {
  it('résume une série', () => {
    expect(describeSet({ kind: 'normal', rep_min: 8, rep_max: 10, target_rpe: 8.5, target_weight_kg: null }, 'bodybuilding', 60))
      .toMatch(/^8–10 @ RPE 8,5, ≈ 60\skg$/)
    expect(describeSet({ kind: 'normal', rep_min: 10, rep_max: null, target_rpe: null, target_weight_kg: null }, 'cardio', null)).toBe('10 min')
  })
})
