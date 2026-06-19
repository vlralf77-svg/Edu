// 한글 자모 데이터 — 자음 14 / 모음 10
// name 은 발음(TTS) 및 라벨에 사용한다.

export interface HangulItem {
  char: string; // 'ㄱ'
  name: string; // '기역' (자음 이름) / '아' (모음 소리)
}

export const consonants: HangulItem[] = [
  { char: 'ㄱ', name: '기역' },
  { char: 'ㄴ', name: '니은' },
  { char: 'ㄷ', name: '디귿' },
  { char: 'ㄹ', name: '리을' },
  { char: 'ㅁ', name: '미음' },
  { char: 'ㅂ', name: '비읍' },
  { char: 'ㅅ', name: '시옷' },
  { char: 'ㅇ', name: '이응' },
  { char: 'ㅈ', name: '지읒' },
  { char: 'ㅊ', name: '치읓' },
  { char: 'ㅋ', name: '키읔' },
  { char: 'ㅌ', name: '티읕' },
  { char: 'ㅍ', name: '피읖' },
  { char: 'ㅎ', name: '히읗' },
];

export const vowels: HangulItem[] = [
  { char: 'ㅏ', name: '아' },
  { char: 'ㅑ', name: '야' },
  { char: 'ㅓ', name: '어' },
  { char: 'ㅕ', name: '여' },
  { char: 'ㅗ', name: '오' },
  { char: 'ㅛ', name: '요' },
  { char: 'ㅜ', name: '우' },
  { char: 'ㅠ', name: '유' },
  { char: 'ㅡ', name: '으' },
  { char: 'ㅣ', name: '이' },
];
