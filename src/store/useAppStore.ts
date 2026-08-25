import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  WorkoutSession,
  Routine,
  BodyRecord,
  MealRecord,
  UserProfile,
  WorkoutSet,
  SetType,
  RoutineExercise,
} from '../types';
import { estimate1RM } from '../utils/oneRepMax';
import { nowISO, uid } from '../utils/format';
import { ROUTINE_TEMPLATES } from '../data/templates';

interface AppState {
  profile: UserProfile;
  sessions: WorkoutSession[];
  activeSessionId: string | null;
  routines: Routine[];
  bodyRecords: BodyRecord[];
  meals: MealRecord[];

  // profile
  updateProfile: (p: Partial<UserProfile>) => void;

  // session
  startSession: (routineId?: string, name?: string) => string;
  endSession: (id: string, memo?: string, mood?: 1 | 2 | 3 | 4 | 5) => void;
  discardSession: (id: string) => void;
  addExerciseToSession: (sessionId: string, exerciseId: string) => void;
  removeExerciseFromSession: (sessionId: string, exerciseId: string) => void;
  addSet: (
    sessionId: string,
    exerciseId: string,
    weightKg: number,
    reps: number,
    setType?: SetType,
    rpe?: number,
  ) => WorkoutSet;
  updateSet: (
    sessionId: string,
    setId: string,
    patch: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'setType' | 'rpe'>>,
  ) => void;
  deleteSet: (sessionId: string, setId: string) => void;

  // routine
  createRoutine: (r: Omit<Routine, 'id' | 'createdAt'>) => Routine;
  updateRoutine: (id: string, patch: Partial<Omit<Routine, 'id' | 'createdAt'>>) => void;
  deleteRoutine: (id: string) => void;
  addExerciseToRoutine: (routineId: string, ex: RoutineExercise) => void;
  removeExerciseFromRoutine: (routineId: string, exerciseId: string) => void;

  // body
  upsertBody: (b: BodyRecord) => void;
  deleteBody: (date: string) => void;

  // meal
  addMeal: (m: Omit<MealRecord, 'id'>) => void;
  deleteMeal: (id: string) => void;

  // 1RM per exercise
  getPersonalBest1RM: (exerciseId: string) => number;
  getLastSetForExercise: (exerciseId: string, beforeSessionId?: string) => WorkoutSet | undefined;

  // reset (개발/테스트용)
  resetAll: () => void;
}

const defaultProfile: UserProfile = {
  nickname: '트레이니',
  defaultRestSec: 90,
  goalType: 'STRENGTH',
  experience: 'INTERMEDIATE',
};

const seedRoutines = (): Routine[] =>
  ROUTINE_TEMPLATES.map((t) => ({
    ...t,
    id: uid('rt'),
    createdAt: nowISO(),
  }));

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      profile: defaultProfile,
      sessions: [],
      activeSessionId: null,
      routines: seedRoutines(),
      bodyRecords: [],
      meals: [],

      updateProfile: (p) =>
        set((s) => ({ profile: { ...s.profile, ...p } })),

      startSession: (routineId, name) => {
        const id = uid('sess');
        const routine = routineId
          ? get().routines.find((r) => r.id === routineId)
          : undefined;
        const session: WorkoutSession = {
          id,
          routineId,
          name: name ?? routine?.name ?? '자유 운동',
          startedAt: nowISO(),
          exercises: (routine?.exercises ?? []).map((re) => ({
            exerciseId: re.exerciseId,
            sets: [],
          })),
        };
        set((s) => ({
          sessions: [session, ...s.sessions],
          activeSessionId: id,
        }));
        return id;
      },

      endSession: (id, memo, mood) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === id
              ? { ...sess, finishedAt: nowISO(), memo, moodRating: mood }
              : sess,
          ),
          activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
        })),

      discardSession: (id) =>
        set((s) => ({
          sessions: s.sessions.filter((x) => x.id !== id),
          activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
        })),

      addExerciseToSession: (sessionId, exerciseId) =>
        set((s) => ({
          sessions: s.sessions.map((sess) => {
            if (sess.id !== sessionId) return sess;
            if (sess.exercises.some((e) => e.exerciseId === exerciseId)) return sess;
            return {
              ...sess,
              exercises: [...sess.exercises, { exerciseId, sets: [] }],
            };
          }),
        })),

      removeExerciseFromSession: (sessionId, exerciseId) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? {
                  ...sess,
                  exercises: sess.exercises.filter((e) => e.exerciseId !== exerciseId),
                }
              : sess,
          ),
        })),

      addSet: (sessionId, exerciseId, weightKg, reps, setType = 'NORMAL', rpe) => {
        const sess = get().sessions.find((x) => x.id === sessionId);
        const exBlock = sess?.exercises.find((e) => e.exerciseId === exerciseId);
        const setNumber = (exBlock?.sets.length ?? 0) + 1;
        const newSet: WorkoutSet = {
          id: uid('set'),
          exerciseId,
          setNumber,
          weightKg,
          reps,
          setType,
          rpe,
          completedAt: nowISO(),
        };
        set((s) => ({
          sessions: s.sessions.map((se) =>
            se.id !== sessionId
              ? se
              : {
                  ...se,
                  exercises: se.exercises.some((e) => e.exerciseId === exerciseId)
                    ? se.exercises.map((e) =>
                        e.exerciseId === exerciseId
                          ? { ...e, sets: [...e.sets, newSet] }
                          : e,
                      )
                    : [...se.exercises, { exerciseId, sets: [newSet] }],
                },
          ),
        }));
        return newSet;
      },

      updateSet: (sessionId, setId, patch) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id !== sessionId
              ? sess
              : {
                  ...sess,
                  exercises: sess.exercises.map((e) => ({
                    ...e,
                    sets: e.sets.map((st) => (st.id === setId ? { ...st, ...patch } : st)),
                  })),
                },
          ),
        })),

      deleteSet: (sessionId, setId) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id !== sessionId
              ? sess
              : {
                  ...sess,
                  exercises: sess.exercises.map((e) => ({
                    ...e,
                    sets: e.sets
                      .filter((st) => st.id !== setId)
                      .map((st, i) => ({ ...st, setNumber: i + 1 })),
                  })),
                },
          ),
        })),

      createRoutine: (r) => {
        const routine: Routine = { ...r, id: uid('rt'), createdAt: nowISO() };
        set((s) => ({ routines: [routine, ...s.routines] }));
        return routine;
      },

      updateRoutine: (id, patch) =>
        set((s) => ({
          routines: s.routines.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),

      deleteRoutine: (id) =>
        set((s) => ({ routines: s.routines.filter((r) => r.id !== id) })),

      addExerciseToRoutine: (routineId, ex) =>
        set((s) => ({
          routines: s.routines.map((r) =>
            r.id !== routineId
              ? r
              : r.exercises.some((e) => e.exerciseId === ex.exerciseId)
              ? r
              : { ...r, exercises: [...r.exercises, ex] },
          ),
        })),

      removeExerciseFromRoutine: (routineId, exerciseId) =>
        set((s) => ({
          routines: s.routines.map((r) =>
            r.id !== routineId
              ? r
              : { ...r, exercises: r.exercises.filter((e) => e.exerciseId !== exerciseId) },
          ),
        })),

      upsertBody: (b) =>
        set((s) => {
          const others = s.bodyRecords.filter((x) => x.date !== b.date);
          return { bodyRecords: [...others, b].sort((a, z) => a.date.localeCompare(z.date)) };
        }),

      deleteBody: (date) =>
        set((s) => ({ bodyRecords: s.bodyRecords.filter((x) => x.date !== date) })),

      addMeal: (m) =>
        set((s) => ({ meals: [{ ...m, id: uid('meal') }, ...s.meals] })),

      deleteMeal: (id) =>
        set((s) => ({ meals: s.meals.filter((m) => m.id !== id) })),

      getPersonalBest1RM: (exerciseId) => {
        let best = 0;
        for (const sess of get().sessions) {
          for (const e of sess.exercises) {
            if (e.exerciseId !== exerciseId) continue;
            for (const st of e.sets) {
              if (st.setType === 'WARMUP') continue;
              const r = estimate1RM(st.weightKg, st.reps);
              if (r > best) best = r;
            }
          }
        }
        return best;
      },

      getLastSetForExercise: (exerciseId, beforeSessionId) => {
        const list = get().sessions;
        for (const sess of list) {
          if (beforeSessionId && sess.id === beforeSessionId) continue;
          for (const e of sess.exercises) {
            if (e.exerciseId !== exerciseId) continue;
            const workingSet = [...e.sets].reverse().find((s) => s.setType !== 'WARMUP');
            if (workingSet) return workingSet;
            if (e.sets.length) return e.sets[e.sets.length - 1];
          }
        }
        return undefined;
      },

      resetAll: () =>
        set({
          profile: defaultProfile,
          sessions: [],
          activeSessionId: null,
          routines: seedRoutines(),
          bodyRecords: [],
          meals: [],
        }),
    }),
    {
      name: 'fitlog-store',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// NOTE: 파생 통계는 컴포넌트에서 useMemo 로 계산하세요.
// Zustand 셀렉터가 매 렌더 새 객체를 반환하면 무한 리렌더가 발생합니다.
