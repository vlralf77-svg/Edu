import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Difficulty = 'easy' | 'normal' | 'hard';

interface Settings {
  soundEnabled: boolean;
  ttsEnabled: boolean;
}

interface GameStore {
  // 보상/진도
  stars: number;
  todayCorrect: number;
  streak: number; // 연속 출석일
  lastPlayDate: string; // "YYYY-MM-DD"
  wordProgress: Record<string, boolean>; // 맞춘 단어 id 기록

  // 설정
  settings: Settings;

  // 액션
  addStar: (count?: number) => void;
  spendStars: (count: number) => boolean; // 힌트 사용 등
  addCorrect: (count?: number) => void;
  markWord: (id: string) => void;
  checkAttendance: () => void; // 출석/연속 출석 갱신
  resetDaily: () => void;
  updateSettings: (partial: Partial<Settings>) => void;
}

const STARS_PER_HINT = 5;

/** 로컬 타임존 기준 YYYY-MM-DD */
const todayStr = (): string => {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
};

/** 두 날짜 문자열의 일수 차이 (a - b) */
const dayDiff = (a: string, b: string): number => {
  const ms = new Date(a).getTime() - new Date(b).getTime();
  return Math.round(ms / 86400000);
};

export const STARS_PER_HINT_VALUE = STARS_PER_HINT;

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      stars: 0,
      todayCorrect: 0,
      streak: 0,
      lastPlayDate: '',
      wordProgress: {},
      settings: {
        soundEnabled: true,
        ttsEnabled: true,
      },

      addStar: (count = 1) => set((s) => ({ stars: s.stars + count })),

      spendStars: (count) => {
        if (get().stars < count) return false;
        set((s) => ({ stars: s.stars - count }));
        return true;
      },

      addCorrect: (count = 1) =>
        set((s) => ({ todayCorrect: s.todayCorrect + count })),

      markWord: (id) =>
        set((s) => ({ wordProgress: { ...s.wordProgress, [id]: true } })),

      checkAttendance: () => {
        const today = todayStr();
        const last = get().lastPlayDate;
        if (last === today) return; // 오늘 이미 출석 처리됨

        if (!last) {
          // 첫 플레이
          set({ streak: 1, lastPlayDate: today, todayCorrect: 0 });
          return;
        }

        const diff = dayDiff(today, last);
        if (diff === 1) {
          // 연속 출석
          const newStreak = get().streak + 1;
          const bonus = newStreak % 3 === 0 ? 3 : 0; // 3일 연속마다 보너스 +3
          set((s) => ({
            streak: newStreak,
            lastPlayDate: today,
            todayCorrect: 0,
            stars: s.stars + bonus,
          }));
        } else {
          // 연속 끊김
          set({ streak: 1, lastPlayDate: today, todayCorrect: 0 });
        }
      },

      resetDaily: () => set({ todayCorrect: 0 }),

      updateSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),
    }),
    {
      name: 'tinylearn-store',
      // Capacitor/웹 모두 localStorage 사용 (Preferences 미설치 환경 호환)
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        stars: s.stars,
        todayCorrect: s.todayCorrect,
        streak: s.streak,
        lastPlayDate: s.lastPlayDate,
        wordProgress: s.wordProgress,
        settings: s.settings,
      }),
    },
  ),
);
