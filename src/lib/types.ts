export type AppRole = 'admin' | 'coach' | 'athlete'

export type EquipmentKind =
  | 'machine' | 'poulie' | 'barre' | 'halteres' | 'banc' | 'rack' | 'kettlebell' | 'autre'

export type MuscleGroup =
  | 'pectoraux' | 'dos' | 'epaules' | 'biceps' | 'triceps' | 'avant_bras'
  | 'quadriceps' | 'ischios' | 'fessiers' | 'mollets' | 'abdominaux' | 'cardio' | 'corps_entier'

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  pectoraux: 'Pectoraux',
  dos: 'Dos',
  epaules: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  avant_bras: 'Avant-bras',
  quadriceps: 'Quadriceps',
  ischios: 'Ischio-jambiers',
  fessiers: 'Fessiers',
  mollets: 'Mollets',
  abdominaux: 'Abdominaux',
  cardio: 'Cardio',
  corps_entier: 'Corps entier',
}

export const EQUIPMENT_LABELS: Record<EquipmentKind, string> = {
  machine: 'Machine guidée',
  poulie: 'Poulie',
  barre: 'Barre',
  halteres: 'Haltères',
  banc: 'Banc',
  rack: 'Rack / cage',
  kettlebell: 'Kettlebell',
  autre: 'Autre',
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrateur',
  coach: 'Coach',
  athlete: 'Athlète',
}

export interface Profile {
  id: string
  full_name: string
  role: AppRole
  coach_id: string | null
  birth_date: string | null
  height_cm: number | null
  created_at: string
}

export interface Gym {
  id: string
  name: string
  address: string | null
}

export interface Equipment {
  id: string
  gym_id: string
  name: string
  brand: string | null
  kind: EquipmentKind
  notes: string | null
}

export interface Exercise {
  id: string
  name: string
  muscle_group: MuscleGroup
  secondary_muscles: MuscleGroup[]
  requires_equipment: boolean
  description: string | null
}

export interface Program {
  id: string
  name: string
  description: string | null
  athlete_id: string | null
  is_active: boolean
  updated_at: string
}

export interface Workout {
  id: string
  program_id: string
  name: string
  position: number
  gym_id: string | null
  notes: string | null
}

export interface WorkoutExercise {
  id: string
  workout_id: string
  exercise_id: string
  equipment_id: string | null
  position: number
  target_sets: number
  rep_min: number
  rep_max: number | null
  target_weight_kg: number | null
  rest_sec: number
  notes: string | null
}

export interface Session {
  id: string
  athlete_id: string
  workout_id: string | null
  gym_id: string | null
  name: string
  started_at: string
  ended_at: string | null
  rpe: number | null
  notes: string | null
}

export interface SessionSet {
  id: string
  session_id: string
  exercise_id: string
  equipment_id: string | null
  exercise_position: number
  set_number: number
  reps: number
  weight_kg: number
  rpe: number | null
  rest_sec: number
  done: boolean
  completed_at: string | null
}

export interface SessionSummary {
  session_id: string
  athlete_id: string
  workout_id: string | null
  gym_id: string | null
  name: string
  started_at: string
  ended_at: string
  rpe: number | null
  duration_sec: number
  sets_done: number
  volume_kg: number
}

export interface ExerciseProgress {
  athlete_id: string
  exercise_id: string
  session_id: string
  started_at: string
  top_weight_kg: number
  estimated_1rm_kg: number | null
  volume_kg: number
  total_reps: number
}

export interface BodyWeight {
  id: string
  athlete_id: string
  measured_on: string
  weight_kg: number
}

export interface OneRepMax {
  id: string
  athlete_id: string
  exercise_id: string
  weight_kg: number
  tested_on: string
  notes: string | null
}

export interface Goal {
  id: string
  athlete_id: string
  exercise_id: string
  target_1rm_kg: number
  target_date: string | null
  achieved_at: string | null
}
