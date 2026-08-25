// FitLog 도메인 타입 정의 (WBS 2.2 DB 스키마 대응 프론트 모델)

export type MuscleCategory =
  | 'CHEST'
  | 'BACK'
  | 'SHOULDER'
  | 'LEG'
  | 'ARM'
  | 'CORE'
  | 'CARDIO'
  | 'FULL';

export type EquipmentType =
  | 'BARBELL'
  | 'DUMBBELL'
  | 'MACHINE'
  | 'CABLE'
  | 'BODYWEIGHT'
  | 'KETTLEBELL'
  | 'CARDIO';

export type SetType = 'NORMAL' | 'WARMUP' | 'DROP' | 'FAILURE';

export type GoalType = 'BULK' | 'CUT' | 'MAINTAIN' | 'STRENGTH';
export type Experience = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface Exercise {
  id: string;
  name: string;
  nameEn?: string;
  category: MuscleCategory;
  equipment: EquipmentType;
  musclePrimary: string;
  muscleSecondary?: string[];
  description?: string;
}

export interface WorkoutSet {
  id: string;
  exerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  setType: SetType;
  rpe?: number;
  completedAt: string; // ISO
}

export interface SessionExercise {
  exerciseId: string;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  routineId?: string;
  name?: string;
  startedAt: string; // ISO
  finishedAt?: string; // ISO
  exercises: SessionExercise[];
  memo?: string;
  moodRating?: 1 | 2 | 3 | 4 | 5;
}

export interface RoutineExercise {
  exerciseId: string;
  targetSets: number;
  targetReps: string; // "8-12" 또는 "AMRAP"
  targetWeight?: number;
  restSeconds: number;
}

export interface Routine {
  id: string;
  name: string;
  description?: string;
  splitType?: string;
  exercises: RoutineExercise[];
  createdAt: string;
}

export interface BodyRecord {
  date: string; // YYYY-MM-DD
  weightKg?: number;
  bodyFatPct?: number;
  skeletalMuscleKg?: number;
  memo?: string;
}

export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

export interface MealRecord {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  mealType: MealType;
  foodName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface UserProfile {
  nickname: string;
  heightCm?: number;
  goalType?: GoalType;
  experience?: Experience;
  defaultRestSec: number;
}

export interface ExerciseRecord {
  exerciseId: string;
  estimated1RM: number;
  actualWeight: number;
  actualReps: number;
  recordedAt: string;
}
