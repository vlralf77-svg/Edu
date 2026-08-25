import type { Exercise } from '../types';

// WBS 섹션 7 시드 데이터 기준 초기 운동 종목 (MVP: 부위별 대표 종목)
export const EXERCISES: Exercise[] = [
  // 가슴 (CHEST)
  { id: 'ex-bench-barbell', name: '바벨 벤치프레스', nameEn: 'Barbell Bench Press', category: 'CHEST', equipment: 'BARBELL', musclePrimary: '대흉근', muscleSecondary: ['삼두', '전면삼각근'] },
  { id: 'ex-bench-incline', name: '인클라인 벤치프레스', nameEn: 'Incline Bench Press', category: 'CHEST', equipment: 'BARBELL', musclePrimary: '대흉근 상부' },
  { id: 'ex-bench-decline', name: '디클라인 벤치프레스', nameEn: 'Decline Bench Press', category: 'CHEST', equipment: 'BARBELL', musclePrimary: '대흉근 하부' },
  { id: 'ex-db-fly', name: '덤벨 플라이', nameEn: 'Dumbbell Fly', category: 'CHEST', equipment: 'DUMBBELL', musclePrimary: '대흉근' },
  { id: 'ex-db-bench', name: '덤벨 벤치프레스', nameEn: 'Dumbbell Bench Press', category: 'CHEST', equipment: 'DUMBBELL', musclePrimary: '대흉근' },
  { id: 'ex-pec-deck', name: '펙덱 플라이', nameEn: 'Pec Deck', category: 'CHEST', equipment: 'MACHINE', musclePrimary: '대흉근' },
  { id: 'ex-cable-cross', name: '케이블 크로스오버', nameEn: 'Cable Crossover', category: 'CHEST', equipment: 'CABLE', musclePrimary: '대흉근' },
  { id: 'ex-dips', name: '딥스', nameEn: 'Dips', category: 'CHEST', equipment: 'BODYWEIGHT', musclePrimary: '대흉근', muscleSecondary: ['삼두'] },
  { id: 'ex-pushup', name: '푸시업', nameEn: 'Push-up', category: 'CHEST', equipment: 'BODYWEIGHT', musclePrimary: '대흉근' },

  // 등 (BACK)
  { id: 'ex-deadlift', name: '데드리프트', nameEn: 'Deadlift', category: 'BACK', equipment: 'BARBELL', musclePrimary: '척추기립근', muscleSecondary: ['광배근', '햄스트링'] },
  { id: 'ex-barbell-row', name: '바벨 로우', nameEn: 'Barbell Row', category: 'BACK', equipment: 'BARBELL', musclePrimary: '광배근' },
  { id: 'ex-pullup', name: '풀업', nameEn: 'Pull-up', category: 'BACK', equipment: 'BODYWEIGHT', musclePrimary: '광배근' },
  { id: 'ex-chinup', name: '친업', nameEn: 'Chin-up', category: 'BACK', equipment: 'BODYWEIGHT', musclePrimary: '광배근', muscleSecondary: ['이두'] },
  { id: 'ex-lat-pulldown', name: '랫풀다운', nameEn: 'Lat Pulldown', category: 'BACK', equipment: 'CABLE', musclePrimary: '광배근' },
  { id: 'ex-seated-row', name: '시티드 로우', nameEn: 'Seated Row', category: 'BACK', equipment: 'CABLE', musclePrimary: '광배근', muscleSecondary: ['승모근'] },
  { id: 'ex-t-bar-row', name: '티바 로우', nameEn: 'T-Bar Row', category: 'BACK', equipment: 'MACHINE', musclePrimary: '광배근' },
  { id: 'ex-db-row', name: '덤벨 로우', nameEn: 'Dumbbell Row', category: 'BACK', equipment: 'DUMBBELL', musclePrimary: '광배근' },
  { id: 'ex-face-pull', name: '페이스풀', nameEn: 'Face Pull', category: 'BACK', equipment: 'CABLE', musclePrimary: '후면삼각근', muscleSecondary: ['승모근'] },

  // 어깨 (SHOULDER)
  { id: 'ex-ohp', name: '오버헤드 프레스', nameEn: 'Overhead Press', category: 'SHOULDER', equipment: 'BARBELL', musclePrimary: '전면삼각근' },
  { id: 'ex-db-shoulder-press', name: '덤벨 숄더프레스', nameEn: 'DB Shoulder Press', category: 'SHOULDER', equipment: 'DUMBBELL', musclePrimary: '전면삼각근' },
  { id: 'ex-side-lat-raise', name: '사이드 레터럴 레이즈', nameEn: 'Side Lateral Raise', category: 'SHOULDER', equipment: 'DUMBBELL', musclePrimary: '측면삼각근' },
  { id: 'ex-rear-delt-fly', name: '리어델트 플라이', nameEn: 'Rear Delt Fly', category: 'SHOULDER', equipment: 'DUMBBELL', musclePrimary: '후면삼각근' },
  { id: 'ex-upright-row', name: '업라이트 로우', nameEn: 'Upright Row', category: 'SHOULDER', equipment: 'BARBELL', musclePrimary: '측면삼각근' },

  // 하체 (LEG)
  { id: 'ex-squat', name: '바벨 스쿼트', nameEn: 'Barbell Squat', category: 'LEG', equipment: 'BARBELL', musclePrimary: '대퇴사두근', muscleSecondary: ['둔근', '햄스트링'] },
  { id: 'ex-front-squat', name: '프론트 스쿼트', nameEn: 'Front Squat', category: 'LEG', equipment: 'BARBELL', musclePrimary: '대퇴사두근' },
  { id: 'ex-leg-press', name: '레그 프레스', nameEn: 'Leg Press', category: 'LEG', equipment: 'MACHINE', musclePrimary: '대퇴사두근' },
  { id: 'ex-leg-curl', name: '레그 컬', nameEn: 'Leg Curl', category: 'LEG', equipment: 'MACHINE', musclePrimary: '햄스트링' },
  { id: 'ex-leg-ext', name: '레그 익스텐션', nameEn: 'Leg Extension', category: 'LEG', equipment: 'MACHINE', musclePrimary: '대퇴사두근' },
  { id: 'ex-lunge', name: '런지', nameEn: 'Lunge', category: 'LEG', equipment: 'DUMBBELL', musclePrimary: '대퇴사두근' },
  { id: 'ex-hip-thrust', name: '힙쓰러스트', nameEn: 'Hip Thrust', category: 'LEG', equipment: 'BARBELL', musclePrimary: '둔근' },
  { id: 'ex-rdl', name: '루마니안 데드리프트', nameEn: 'Romanian Deadlift', category: 'LEG', equipment: 'BARBELL', musclePrimary: '햄스트링', muscleSecondary: ['둔근'] },
  { id: 'ex-calf-raise', name: '카프 레이즈', nameEn: 'Calf Raise', category: 'LEG', equipment: 'MACHINE', musclePrimary: '비복근' },
  { id: 'ex-bulgarian-split', name: '불가리안 스플릿 스쿼트', nameEn: 'Bulgarian Split Squat', category: 'LEG', equipment: 'DUMBBELL', musclePrimary: '대퇴사두근' },

  // 팔 (ARM)
  { id: 'ex-barbell-curl', name: '바벨 컬', nameEn: 'Barbell Curl', category: 'ARM', equipment: 'BARBELL', musclePrimary: '이두근' },
  { id: 'ex-db-curl', name: '덤벨 컬', nameEn: 'Dumbbell Curl', category: 'ARM', equipment: 'DUMBBELL', musclePrimary: '이두근' },
  { id: 'ex-hammer-curl', name: '해머 컬', nameEn: 'Hammer Curl', category: 'ARM', equipment: 'DUMBBELL', musclePrimary: '상완근' },
  { id: 'ex-preacher-curl', name: '프리처 컬', nameEn: 'Preacher Curl', category: 'ARM', equipment: 'MACHINE', musclePrimary: '이두근' },
  { id: 'ex-cable-curl', name: '케이블 컬', nameEn: 'Cable Curl', category: 'ARM', equipment: 'CABLE', musclePrimary: '이두근' },
  { id: 'ex-close-grip-bench', name: '클로즈그립 벤치프레스', nameEn: 'Close-Grip Bench', category: 'ARM', equipment: 'BARBELL', musclePrimary: '삼두근' },
  { id: 'ex-tri-pushdown', name: '트라이셉스 푸시다운', nameEn: 'Triceps Pushdown', category: 'ARM', equipment: 'CABLE', musclePrimary: '삼두근' },
  { id: 'ex-overhead-ext', name: '오버헤드 익스텐션', nameEn: 'Overhead Extension', category: 'ARM', equipment: 'DUMBBELL', musclePrimary: '삼두근' },
  { id: 'ex-skull-crusher', name: '스컬 크러셔', nameEn: 'Skull Crusher', category: 'ARM', equipment: 'BARBELL', musclePrimary: '삼두근' },

  // 코어 (CORE)
  { id: 'ex-plank', name: '플랭크', nameEn: 'Plank', category: 'CORE', equipment: 'BODYWEIGHT', musclePrimary: '복근' },
  { id: 'ex-crunch', name: '크런치', nameEn: 'Crunch', category: 'CORE', equipment: 'BODYWEIGHT', musclePrimary: '복직근' },
  { id: 'ex-leg-raise', name: '레그 레이즈', nameEn: 'Leg Raise', category: 'CORE', equipment: 'BODYWEIGHT', musclePrimary: '하복부' },
  { id: 'ex-hanging-leg-raise', name: '행잉 레그 레이즈', nameEn: 'Hanging Leg Raise', category: 'CORE', equipment: 'BODYWEIGHT', musclePrimary: '하복부' },
  { id: 'ex-cable-woodchop', name: '케이블 우드찹', nameEn: 'Cable Woodchop', category: 'CORE', equipment: 'CABLE', musclePrimary: '복사근' },
  { id: 'ex-russian-twist', name: '러시안 트위스트', nameEn: 'Russian Twist', category: 'CORE', equipment: 'BODYWEIGHT', musclePrimary: '복사근' },

  // 유산소 (CARDIO)
  { id: 'ex-running', name: '러닝', nameEn: 'Running', category: 'CARDIO', equipment: 'CARDIO', musclePrimary: '심폐' },
  { id: 'ex-cycling', name: '사이클', nameEn: 'Cycling', category: 'CARDIO', equipment: 'CARDIO', musclePrimary: '심폐' },
  { id: 'ex-rowing', name: '로잉머신', nameEn: 'Rowing', category: 'CARDIO', equipment: 'CARDIO', musclePrimary: '심폐' },
  { id: 'ex-jump-rope', name: '줄넘기', nameEn: 'Jump Rope', category: 'CARDIO', equipment: 'CARDIO', musclePrimary: '심폐' },
  { id: 'ex-elliptical', name: '일립티컬', nameEn: 'Elliptical', category: 'CARDIO', equipment: 'CARDIO', musclePrimary: '심폐' },

  // 전신 (FULL)
  { id: 'ex-clean-jerk', name: '클린 앤 저크', nameEn: 'Clean & Jerk', category: 'FULL', equipment: 'BARBELL', musclePrimary: '전신' },
  { id: 'ex-burpee', name: '버피', nameEn: 'Burpee', category: 'FULL', equipment: 'BODYWEIGHT', musclePrimary: '전신' },
  { id: 'ex-kb-swing', name: '케틀벨 스윙', nameEn: 'Kettlebell Swing', category: 'FULL', equipment: 'DUMBBELL', musclePrimary: '둔근', muscleSecondary: ['광배근'] },
];

export const CATEGORY_LABEL: Record<string, string> = {
  CHEST: '가슴',
  BACK: '등',
  SHOULDER: '어깨',
  LEG: '하체',
  ARM: '팔',
  CORE: '코어',
  CARDIO: '유산소',
  FULL: '전신',
};

export const EQUIPMENT_LABEL: Record<string, string> = {
  BARBELL: '바벨',
  DUMBBELL: '덤벨',
  MACHINE: '머신',
  CABLE: '케이블',
  BODYWEIGHT: '맨몸',
  CARDIO: '유산소',
};

export const findExercise = (id: string) => EXERCISES.find((e) => e.id === id);
