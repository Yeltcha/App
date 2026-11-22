import { describe, expect, it } from 'vitest'
import { groupLastSession, prefillWeight, previousSetAt } from './lastSession'
import type { PlannedSet } from './setPlan'

const row = (exercise_id: string, session_id: string, set_number: number, weight_kg: number, completed_at: string) =>
  ({ exercise_id, session_id, set_number, weight_kg, reps: 10, rpe: null, completed_at })

// Du plus récent au plus ancien, comme la requête
const rows = [
  row('curl', 's2', 3, 16, '2026-11-20T10:12:00Z'),
  row('curl', 's2', 1, 14, '2026-11-20T10:05:00Z'),
  row('curl', 's2', 2, 15, '2026-11-20T10:08:00Z'),
  row('curl', 's1', 1, 12, '2026-11-13T10:05:00Z'),
  row('presse', 's1', 1, 140, '2026-11-13T10:00:00Z'),
]

describe('groupLastSession', () => {
  it('garde seulement la séance la plus récente, séries dans l’ordre', () => {
    const last = groupLastSession(rows)
    expect(last.get('curl')?.session_id).toBe('s2')
    expect(last.get('curl')?.sets.map((s) => s.weight_kg)).toEqual([14, 15, 16])
    expect(last.get('curl')?.date).toBe('2026-11-20')
    expect(last.get('presse')?.sets).toHaveLength(1)
  })
})

describe('prefillWeight', () => {
  const previous = groupLastSession(rows).get('curl')
  const set: PlannedSet = { kind: 'normal', rep_min: 10, rep_max: 12, target_rpe: null, target_weight_kg: null }
  const max = { kg: 100, source: 'test' as const, date: '2026-11-01' }

  it('bodybuilding : reprend la charge de la même série la dernière fois', () => {
    expect([0, 1, 2].map((i) => prefillWeight('bodybuilding', set, i, previous, undefined))).toEqual([14, 15, 16])
    // Une série de plus qu'avant : on reprend la dernière faite
    expect(prefillWeight('bodybuilding', set, 3, previous, undefined)).toBe(16)
    expect(previousSetAt(previous, 5)?.weight_kg).toBe(16)
  })
  it('bodybuilding : la dernière performance passe avant le calcul au RPE', () => {
    expect(prefillWeight('bodybuilding', { ...set, target_rpe: 8 }, 0, previous, max)).toBe(14)
    expect(prefillWeight('bodybuilding', { ...set, target_rpe: 8 }, 0, undefined, max)).toBe(67.5)
  })
  it('force : le calcul au RPE passe avant la dernière performance', () => {
    expect(prefillWeight('force', { ...set, rep_min: 5, target_rpe: 8 }, 0, previous, max)).toBe(80)
    expect(prefillWeight('force', set, 1, previous, max)).toBe(15)
  })
  it('une charge fixée par le coach reste prioritaire', () => {
    expect(prefillWeight('bodybuilding', { ...set, target_weight_kg: 20 }, 0, previous, max)).toBe(20)
  })
  it('première fois : 0', () => {
    expect(prefillWeight('bodybuilding', set, 0, undefined, undefined)).toBe(0)
  })
})
