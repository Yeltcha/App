import { useQuery } from '@tanstack/react-query'
import { supabase, unwrap } from './supabase'
import type { Program, Workout } from './types'

/** Séance conseillée : la suivante dans le cycle du programme actif. */
export function useNextWorkout(athleteId: string | undefined) {
  return useQuery({
    queryKey: ['next-workout', athleteId],
    enabled: Boolean(athleteId),
    queryFn: async () => (unwrap(await supabase.rpc('next_workout', { p_athlete: athleteId })) as Workout[])[0] ?? null,
  })
}

export interface ProgramWithWorkouts extends Program {
  workouts: (Workout & { exerciseCount: number })[]
}

/** Programme actif de l'athlète avec ses séances (dans l'ordre) et le nombre d'exercices de chacune. */
export function useMyProgram(athleteId: string | undefined) {
  return useQuery({
    queryKey: ['my-program', athleteId],
    enabled: Boolean(athleteId),
    queryFn: async (): Promise<ProgramWithWorkouts | null> => {
      const p = unwrap(
        await supabase.from('programs').select('*').eq('athlete_id', athleteId!).eq('is_active', true)
          .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      ) as Program | null
      if (!p) return null
      const workouts = unwrap(
        await supabase.from('workouts').select('*, workout_exercises(count)').eq('program_id', p.id).order('position'),
      ) as (Workout & { workout_exercises: { count: number }[] })[]
      return {
        ...p,
        workouts: workouts.map(({ workout_exercises, ...w }) => ({ ...w, exerciseCount: workout_exercises[0]?.count ?? 0 })),
      }
    },
  })
}
