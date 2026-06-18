import { useCallback, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';

type SoundName = 'correct' | 'wrong' | 'win' | 'tap';

// 각 효과음을 Web Audio API로 합성 (효과음 에셋 없이 동작)
const TONES: Record<SoundName, { freqs: number[]; dur: number; type: OscillatorType }> = {
  correct: { freqs: [523.25, 659.25, 783.99], dur: 0.12, type: 'sine' }, // 도-미-솔 상행
  wrong: { freqs: [311.13, 233.08], dur: 0.18, type: 'triangle' }, // 하행 (가벼운 부저)
  win: { freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.15, type: 'sine' }, // 팡파레
  tap: { freqs: [440], dur: 0.06, type: 'sine' },
};

/**
 * Web Audio API 기반 효과음 훅.
 * 정답/오답/승리/탭 피드백을 합성음으로 재생한다.
 */
export function useSound() {
  const soundEnabled = useGameStore((s) => s.settings.soundEnabled);
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    // 모바일에서 사용자 제스처 후 resume 필요
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const play = useCallback(
    (name: SoundName) => {
      if (!soundEnabled) return;
      const ctx = getCtx();
      if (!ctx) return;

      const { freqs, dur, type } = TONES[name];
      const now = ctx.currentTime;

      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;

        const start = now + i * dur;
        const end = start + dur;
        // 부드러운 어택/릴리스 (클릭 노이즈 방지)
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(end + 0.02);
      });
    },
    [soundEnabled, getCtx],
  );

  return { play };
}
