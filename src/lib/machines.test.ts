import { describe, expect, it } from 'vitest'
import { exerciseChoices, machinesFor, resolveMachine } from './machines'
import type { Equipment, Exercise } from './types'

const eq = (id: string, gym_id: string, brand: string | null): Equipment =>
  ({ id, gym_id, name: id, brand_id: brand ? `${gym_id}-${brand}` : null, brand, kind: 'machine', notes: null })

const equipment = [
  eq('peck-centre', 'centre', 'Technogym'),
  eq('peck-nord', 'nord', 'technogym'),
  eq('peck-nord-hs', 'nord', 'Hammer Strength'),
  eq('viking-nord', 'nord', 'GYM80'),
]
const links = [
  { exercise_id: 'peck', equipment_id: 'peck-centre' },
  { exercise_id: 'peck', equipment_id: 'peck-nord' },
  { exercise_id: 'peck', equipment_id: 'peck-nord-hs' },
  { exercise_id: 'viking', equipment_id: 'viking-nord' },
]

describe('machinesFor', () => {
  it('filtre par salle et par marque, sans tenir compte de la casse', () => {
    expect(machinesFor('peck', equipment, links).map((e) => e.id)).toEqual(['peck-centre', 'peck-nord', 'peck-nord-hs'])
    expect(machinesFor('peck', equipment, links, { gymId: 'nord' }).map((e) => e.id)).toEqual(['peck-nord', 'peck-nord-hs'])
    expect(machinesFor('peck', equipment, links, { brand: 'TECHNOGYM' }).map((e) => e.id)).toEqual(['peck-centre', 'peck-nord'])
  })
})

describe('resolveMachine', () => {
  it('garde la machine programmée si elle est dans la salle', () => {
    expect(resolveMachine({ exerciseId: 'peck', equipmentId: 'peck-centre' }, 'centre', equipment, links)).toBe('peck-centre')
  })
  it('dans une autre salle, prend la machine de la même marque', () => {
    expect(resolveMachine({ exerciseId: 'peck', equipmentId: 'peck-centre' }, 'nord', equipment, links)).toBe('peck-nord')
  })
  it('sans machine de la même marque dans la salle, aucune', () => {
    expect(resolveMachine({ exerciseId: 'viking', equipmentId: 'viking-nord' }, 'centre', equipment, links)).toBeNull()
    expect(resolveMachine({ exerciseId: 'viking', equipmentId: null }, 'nord', equipment, links)).toBeNull()
  })
})

describe('exerciseChoices', () => {
  const ex = (id: string, requires_equipment: boolean): Exercise =>
    ({ id, name: id, muscle_group: 'pectoraux', secondary_muscles: [], requires_equipment, description: null })
  const exercises = [ex('peck', true), ex('viking', true), ex('squat', false)]
  const unbranded = { ...eq('peck-nord-sans', 'nord', null) }

  it('sans salle : seulement les exercices sans machine', () => {
    const choices = exerciseChoices(exercises, equipment, links, null)
    expect(choices.free.map((e) => e.id)).toEqual(['squat'])
    expect(choices.brands).toEqual([])
  })
  it('avec une salle : exercices sans machine + machines de la salle par marque', () => {
    const choices = exerciseChoices(exercises, [...equipment, unbranded],
      [...links, { exercise_id: 'peck', equipment_id: 'peck-nord-sans' }], 'nord')
    expect(choices.brands.map((g) => g.brand)).toEqual(['GYM80', 'Hammer Strength', 'technogym', 'Sans marque'])
    expect(choices.brands[0].items.map((i) => `${i.exercise.id}/${i.machine.id}`)).toEqual(['viking/viking-nord'])
    expect(choices.brands.flatMap((g) => g.items).some((i) => i.machine.gym_id !== 'nord')).toBe(false)
  })
})
