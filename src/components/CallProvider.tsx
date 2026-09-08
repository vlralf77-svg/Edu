import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useCallStore } from '../store/useCallStore';
import { peerService } from '../services/peer';
import {
  startRingtone,
  stopRingtone,
  startVibration,
  stopVibration,
  startOutgoingTone,
  stopOutgoingTone,
  showIncomingNotification,
  clearIncomingNotification,
  requestNotificationPermission,
} from '../services/notify';

/**
 * 앱 전역 통화 관리자.
 * - Peer 초기화, 수신 콜 감지, 링/진동/알림 시작, 원격 오디오 재생
 * - 통화 상태 변화에 맞춰 /call 화면으로 자동 라우팅
 */
export default function CallProvider() {
  const profile = useAppStore((s) => s.profile);
  const findFamily = useAppStore((s) => s.findFamily);
  const navigate = useNavigate();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    void requestNotificationPermission();

    const {
      setPeerReady,
      setStatus,
      setRemote,
      setError,
    } = useCallStore.getState();

    peerService.init(profile.peerId, {
      onReady: (id) => setPeerReady(true, id),
      onError: (err) => setError(err.message || '연결 오류'),
      onRemoteStream: (stream) => {
        if (!audioRef.current) return;
        audioRef.current.srcObject = stream;
        audioRef.current.play().catch(() => { /* 자동 재생 정책 */ });
      },
      onIncoming: (info) => {
        const known = findFamily(info.fromId);
        // 등록되지 않은 상대는 자동 거절 (가족만 통화 정책)
        if (!known) {
          peerService.rejectIncoming();
          return;
        }
        setRemote({ id: info.fromId, name: known.name, emoji: known.emoji });
        setStatus('incoming');
        startRingtone();
        startVibration();
        void showIncomingNotification(known.name);
      },
      onCallEnded: () => {
        stopRingtone();
        stopVibration();
        stopOutgoingTone();
        void clearIncomingNotification();
        setStatus('ended');
        setTimeout(() => {
          const s = useCallStore.getState();
          s.setStatus('idle');
          s.setRemote(null);
          s.resetDuration();
          s.setMuted(false);
        }, 700);
      },
    });
  }, [profile?.peerId]);

  // 통화 시간 카운터 & 라우팅
  useEffect(() => {
    const unsub = useCallStore.subscribe((state, prev) => {
      if (state.status !== prev.status) {
        if (state.status === 'active') {
          useCallStore.getState().resetDuration();
          if (tickRef.current) clearInterval(tickRef.current);
          tickRef.current = window.setInterval(
            () => useCallStore.getState().tickDuration(),
            1000,
          );
          stopRingtone();
          stopVibration();
          stopOutgoingTone();
          void clearIncomingNotification();
        } else if (prev.status === 'active') {
          if (tickRef.current) {
            clearInterval(tickRef.current);
            tickRef.current = null;
          }
        }

        // 라우팅
        if (
          state.status === 'calling' ||
          state.status === 'incoming' ||
          state.status === 'active'
        ) {
          navigate('/call');
        } else if (state.status === 'idle') {
          navigate('/', { replace: true });
        }
      }
    });
    return () => unsub();
  }, [navigate]);

  return <audio ref={audioRef} autoPlay playsInline />;
}

/** 외부 액션 헬퍼 — 어디서든 호출 가능 */
export async function startCallTo(peerId: string, name: string, emoji: string) {
  const s = useCallStore.getState();
  try {
    s.setError(null);
    s.setRemote({ id: peerId, name, emoji });
    s.setStatus('calling');
    startOutgoingTone();
    await peerService.call(peerId);
  } catch (e) {
    s.setError((e as Error).message);
    stopOutgoingTone();
    s.setStatus('idle');
    s.setRemote(null);
  }
}

export async function answerIncoming() {
  try {
    await peerService.answerIncoming();
    useCallStore.getState().setStatus('active');
  } catch (e) {
    useCallStore.getState().setError((e as Error).message);
    peerService.hangup();
  }
}

export function rejectIncoming() {
  peerService.rejectIncoming();
  stopRingtone();
  stopVibration();
  void clearIncomingNotification();
  const s = useCallStore.getState();
  s.setStatus('idle');
  s.setRemote(null);
}

export function hangup() {
  peerService.hangup();
  stopOutgoingTone();
  stopRingtone();
  stopVibration();
  void clearIncomingNotification();
}

export function toggleMute() {
  const muted = peerService.toggleMute();
  useCallStore.getState().setMuted(muted);
  return muted;
}
