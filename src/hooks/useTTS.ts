import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';

/**
 * Web Speech API (speechSynthesis) 래퍼.
 * 영단어 발음 재생에 사용. 영어 보이스를 우선 선택한다.
 */
export function useTTS() {
  const ttsEnabled = useGameStore((s) => s.settings.ttsEnabled);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  // 영어 보이스 캐싱 (비동기 로드 대응)
  useEffect(() => {
    if (!supported) return;

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      voiceRef.current =
        voices.find((v) => v.lang.startsWith('en-US')) ??
        voices.find((v) => v.lang.startsWith('en')) ??
        null;
    };

    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !ttsEnabled || !text) return;
      window.speechSynthesis.cancel(); // 진행 중인 발음 중단
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.rate = 0.85; // 아이들이 따라하기 쉽게 천천히
      utter.pitch = 1.1;
      if (voiceRef.current) utter.voice = voiceRef.current;
      window.speechSynthesis.speak(utter);
    },
    [supported, ttsEnabled],
  );

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  return { speak, stop, supported };
}
