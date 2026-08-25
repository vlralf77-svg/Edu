import type { Routine } from '../types';

// 기본 제공 루틴 템플릿 (WBS 3.2 분할법 템플릿 대응)
export const ROUTINE_TEMPLATES: Omit<Routine, 'id' | 'createdAt'>[] = [
  {
    name: 'PPL - Push Day',
    description: '가슴 · 어깨 · 삼두 (밀기)',
    splitType: 'PUSH_PULL_LEG',
    exercises: [
      { exerciseId: 'ex-bench-barbell', targetSets: 4, targetReps: '6-8', restSeconds: 120 },
      { exerciseId: 'ex-bench-incline', targetSets: 3, targetReps: '8-10', restSeconds: 90 },
      { exerciseId: 'ex-ohp', targetSets: 3, targetReps: '8-10', restSeconds: 90 },
      { exerciseId: 'ex-side-lat-raise', targetSets: 3, targetReps: '12-15', restSeconds: 60 },
      { exerciseId: 'ex-tri-pushdown', targetSets: 3, targetReps: '10-12', restSeconds: 60 },
    ],
  },
  {
    name: 'PPL - Pull Day',
    description: '등 · 이두 (당기기)',
    splitType: 'PUSH_PULL_LEG',
    exercises: [
      { exerciseId: 'ex-deadlift', targetSets: 3, targetReps: '5', restSeconds: 180 },
      { exerciseId: 'ex-pullup', targetSets: 4, targetReps: 'AMRAP', restSeconds: 90 },
      { exerciseId: 'ex-barbell-row', targetSets: 3, targetReps: '8-10', restSeconds: 90 },
      { exerciseId: 'ex-seated-row', targetSets: 3, targetReps: '10-12', restSeconds: 75 },
      { exerciseId: 'ex-barbell-curl', targetSets: 3, targetReps: '10-12', restSeconds: 60 },
      { exerciseId: 'ex-hammer-curl', targetSets: 3, targetReps: '10-12', restSeconds: 60 },
    ],
  },
  {
    name: 'PPL - Leg Day',
    description: '하체 종합',
    splitType: 'PUSH_PULL_LEG',
    exercises: [
      { exerciseId: 'ex-squat', targetSets: 4, targetReps: '6-8', restSeconds: 150 },
      { exerciseId: 'ex-rdl', targetSets: 3, targetReps: '8-10', restSeconds: 120 },
      { exerciseId: 'ex-leg-press', targetSets: 3, targetReps: '10-12', restSeconds: 90 },
      { exerciseId: 'ex-leg-curl', targetSets: 3, targetReps: '12-15', restSeconds: 60 },
      { exerciseId: 'ex-calf-raise', targetSets: 4, targetReps: '15-20', restSeconds: 45 },
    ],
  },
  {
    name: '풀바디 (초보자)',
    description: '주 3회 전신 훈련',
    splitType: 'FULL_BODY',
    exercises: [
      { exerciseId: 'ex-squat', targetSets: 3, targetReps: '8-10', restSeconds: 120 },
      { exerciseId: 'ex-bench-barbell', targetSets: 3, targetReps: '8-10', restSeconds: 120 },
      { exerciseId: 'ex-barbell-row', targetSets: 3, targetReps: '8-10', restSeconds: 90 },
      { exerciseId: 'ex-ohp', targetSets: 3, targetReps: '8-10', restSeconds: 90 },
      { exerciseId: 'ex-plank', targetSets: 3, targetReps: '60초', restSeconds: 60 },
    ],
  },
];
