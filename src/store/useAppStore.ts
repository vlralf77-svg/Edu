import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FamilyRole = '엄마' | '아빠' | '형' | '누나' | '오빠' | '언니' | '동생' | '할머니' | '할아버지' | '아들' | '딸' | '기타';

export interface FamilyMember {
  id: string;          // 상대방 Peer ID
  name: string;
  role: FamilyRole;
  emoji: string;       // 프로필 이모지
  addedAt: number;
}

export interface Profile {
  peerId: string;      // 내 Peer ID (앱 최초 실행 시 자동 생성)
  name: string;
  role: FamilyRole;
  emoji: string;
}

interface AppState {
  profile: Profile | null;
  family: FamilyMember[];
  setProfile: (p: Profile) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  addFamily: (m: FamilyMember) => void;
  removeFamily: (id: string) => void;
  findFamily: (id: string) => FamilyMember | undefined;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      profile: null,
      family: [],
      setProfile: (p) => set({ profile: p }),
      updateProfile: (patch) =>
        set((s) => (s.profile ? { profile: { ...s.profile, ...patch } } : s)),
      addFamily: (m) =>
        set((s) => {
          if (s.family.some((f) => f.id === m.id)) return s;
          return { family: [...s.family, m] };
        }),
      removeFamily: (id) =>
        set((s) => ({ family: s.family.filter((f) => f.id !== id) })),
      findFamily: (id) => get().family.find((f) => f.id === id),
      reset: () => set({ profile: null, family: [] }),
    }),
    { name: 'family-call.v1' },
  ),
);

// 짧고 사람이 옮기기 쉬운 Peer ID 생성 (family 접두 + 8자 base36)
export function generatePeerId(): string {
  const rand = Math.random().toString(36).slice(2, 6) + Date.now().toString(36).slice(-4);
  return `fam-${rand}`;
}
