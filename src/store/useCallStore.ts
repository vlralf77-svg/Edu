import { create } from 'zustand';
import type { CallStatus } from '../services/peer';

interface CallState {
  status: CallStatus;
  peerReady: boolean;
  myPeerId: string | null;
  // 활성/수신/발신 상대 정보
  remoteId: string | null;
  remoteName: string | null;
  remoteEmoji: string | null;
  // 통화 지속 시간 (초) — active일 때만 카운트
  durationSec: number;
  muted: boolean;
  lastError: string | null;

  setStatus: (s: CallStatus) => void;
  setPeerReady: (ready: boolean, id: string | null) => void;
  setRemote: (info: { id: string; name: string; emoji: string } | null) => void;
  tickDuration: () => void;
  resetDuration: () => void;
  setMuted: (m: boolean) => void;
  setError: (msg: string | null) => void;
}

export const useCallStore = create<CallState>()((set) => ({
  status: 'idle',
  peerReady: false,
  myPeerId: null,
  remoteId: null,
  remoteName: null,
  remoteEmoji: null,
  durationSec: 0,
  muted: false,
  lastError: null,

  setStatus: (s) => set({ status: s }),
  setPeerReady: (ready, id) => set({ peerReady: ready, myPeerId: id }),
  setRemote: (info) =>
    set(
      info
        ? { remoteId: info.id, remoteName: info.name, remoteEmoji: info.emoji }
        : { remoteId: null, remoteName: null, remoteEmoji: null },
    ),
  tickDuration: () => set((s) => ({ durationSec: s.durationSec + 1 })),
  resetDuration: () => set({ durationSec: 0 }),
  setMuted: (m) => set({ muted: m }),
  setError: (msg) => set({ lastError: msg }),
}));
