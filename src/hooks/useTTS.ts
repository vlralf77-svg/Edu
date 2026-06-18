import { useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useGameStore } from '@/store/useGameStore';

/**
 * TTS(발음) 래퍼.
 * - 네이티브(Android/iOS): @capacitor-community/text-to-speech 플러그인 사용
 *   (안드로이드 WebView의 Web Speech API는 동작하지 않는 경우가 많아 네이티브 엔진 사용)
 * - 웹: Web Speech API(speechSynthesis) 사용
 */
export function useTTS() {
  const ttsEnabled = useGameStore((s) => s.settings.ttsEnabled);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const isNative = Capacitor.isNativePlatform();
  const webSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;
  // 네이티브에서는 플러그인으로 항상 지원
  const supported = isNative || webSupported;

  // 웹: 영어 보이스 캐싱 (비동기 로드 대응)
  useEffect(() => {
    if (isNative || !webSupported) return;

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
  }, [isNative, webSupported]);

  const speak = useCallback(
    async (text: string, lang: string = 'en-US') => {
      if (!ttsEnabled || !text) return;
      const isKo = lang.startsWith('ko');

      if (isNative) {
        // 네이티브 TTS 엔진 사용
        try {
          const { TextToSpeech } = await import(
            '@capacitor-community/text-to-speech'
          );
          await TextToSpeech.stop(); // 진행 중 발음 중단
          await TextToSpeech.speak({
            text,
            lang,
            rate: 0.9, // 아이들이 따라하기 쉽게 약간 느리게
            pitch: 1.1,
            volume: 1.0,
            category: 'ambient',
          });
        } catch (e) {
          console.warn('[tts] native speak failed', e);
        }
        return;
      }

      // 웹: Web Speech API
      if (!webSupported) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = 0.85;
      utter.pitch = 1.1;
      // 영어일 때만 캐싱한 영어 보이스를 지정 (한국어는 기본 보이스 사용)
      if (!isKo && voiceRef.current) utter.voice = voiceRef.current;
      window.speechSynthesis.speak(utter);
    },
    [ttsEnabled, isNative, webSupported],
  );

  const stop = useCallback(async () => {
    if (isNative) {
      try {
        const { TextToSpeech } = await import(
          '@capacitor-community/text-to-speech'
        );
        await TextToSpeech.stop();
      } catch {
        /* noop */
      }
      return;
    }
    if (webSupported) window.speechSynthesis.cancel();
  }, [isNative, webSupported]);

  return { speak, stop, supported };
}
