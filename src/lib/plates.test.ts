import { describe, expect, it } from 'vitest'
import { isBarbellExercise, loadBar } from './plates'

describe('loadBar', () => {
  it('charge 100 kg avec 25 + 15 de chaque côté', () => {
    expect(loadBar(100)).toEqual({ perSide: [25, 15], remainder: 0 })
  })
  it('gère les petits disques', () => {
    expect(loadBar(102.5)).toEqual({ perSide: [25, 15, 1], remainder: 0.25 })
    expect(loadBar(105)).toEqual({ perSide: [25, 15, 2.5], remainder: 0 })
  })
  it('renvoie une barre vide à 20 kg et rien en dessous', () => {
    expect(loadBar(20)).toEqual({ perSide: [], remainder: 0 })
    expect(loadBar(14)).toBeNull()
  })
})

describe('isBarbellExercise', () => {
  it('reconnaît les mouvements à la barre', () => {
    expect(isBarbellExercise('Squat barre')).toBe(true)
    expect(isBarbellExercise('Soulevé de terre')).toBe(true)
    expect(isBarbellExercise('Développé incliné haltères')).toBe(false)
    expect(isBarbellExercise('Presse à cuisses')).toBe(false)
  })
})
