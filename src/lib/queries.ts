import { useQuery } from '@tanstack/react-query'
import { supabase, unwrap } from './supabase'
import type { Equipment, Exercise, Gym, Profile } from './types'

export function useExercises() {
  return useQuery({
    queryKey: ['exercises'],
    queryFn: async () =>
      unwrap(await supabase.from('exercises').select('*').order('name')) as Exercise[],
    staleTime: 5 * 60_000,
  })
}

export function useGyms() {
  return useQuery({
    queryKey: ['gyms'],
    queryFn: async () => unwrap(await supabase.from('gyms').select('*').order('name')) as Gym[],
    staleTime: 5 * 60_000,
  })
}

export function useEquipment() {
  return useQuery({
    queryKey: ['equipment'],
    queryFn: async () =>
      unwrap(await supabase.from('equipment').select('*').order('name')) as Equipment[],
    staleTime: 5 * 60_000,
  })
}

export function useExerciseEquipment() {
  return useQuery({
    queryKey: ['exercise_equipment'],
    queryFn: async () =>
      unwrap(await supabase.from('exercise_equipment').select('*')) as {
        exercise_id: string
        equipment_id: string
      }[],
    staleTime: 5 * 60_000,
  })
}

/** Exercices disponibles dans une salle (selon ses équipements). */
export function useGymExercises(gymId: string | null | undefined) {
  return useQuery({
    queryKey: ['gym_exercises', gymId],
    queryFn: async () => {
      if (!gymId) return unwrap(await supabase.from('exercises').select('*').order('name')) as Exercise[]
      return unwrap(
        await supabase.from('gym_exercises').select('*').eq('gym_id', gymId).order('name'),
      ) as Exercise[]
    },
    staleTime: 5 * 60_000,
  })
}

export function useProfiles(enabled = true) {
  return useQuery({
    queryKey: ['profiles'],
    enabled,
    queryFn: async () =>
      unwrap(await supabase.from('profiles').select('*').order('full_name')) as Profile[],
  })
}

export function byId<T extends { id: string }>(items: T[] | undefined): Map<string, T> {
  return new Map((items ?? []).map((item) => [item.id, item]))
}
