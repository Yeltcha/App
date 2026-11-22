import { describe, expect, it } from 'vitest'
import { brandsOf, machinesFor, resolveMachine } from './machines'
import type { Equipment } from './types'

const eq = (id: string, gym_id: string, brand: string | null): Equipment =>
  ({ id, gym_id, name: id, brand, kind: 'machine', notes: null })

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

describe('brandsOf', () => {
  it('dédoublonne les marques', () => {
    expect(brandsOf(equipment)).toEqual(['GYM80', 'Hammer Strength', 'Technogym'])
  })
})

describe('resolveMachine', () => {
  it('garde la machine programmée si elle est dans la salle', () => {
    expect(resolveMachine({ exerciseId: 'peck', equipmentId: 'peck-centre', brand: null }, 'centre', equipment, links)).toBe('peck-centre')
  })
  it('dans une autre salle, prend la machine de la même marque', () => {
    expect(resolveMachine({ exerciseId: 'peck', equipmentId: 'peck-centre', brand: null }, 'nord', equipment, links)).toBe('peck-nord')
  })
  it('avec seulement une marque, trouve la machine de la salle', () => {
    expect(resolveMachine({ exerciseId: 'viking', equipmentId: null, brand: 'GYM80' }, 'nord', equipment, links)).toBe('viking-nord')
    expect(resolveMachine({ exerciseId: 'viking', equipmentId: null, brand: 'GYM80' }, 'centre', equipment, links)).toBeNull()
    expect(resolveMachine({ exerciseId: 'viking', equipmentId: null, brand: 'GYM80' }, null, equipment, links)).toBeNull()
  })
})
